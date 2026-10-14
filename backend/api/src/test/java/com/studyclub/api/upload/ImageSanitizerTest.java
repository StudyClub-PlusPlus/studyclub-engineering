package com.studyclub.api.upload;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.CRC32;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/** 실제 사진 대신 형식 규칙대로 조립한 바이트로 검사한다 — 어떤 세그먼트·청크가 남고 빠지는지 바이트 단위로 확인할 수 있다. */
class ImageSanitizerTest {

    private static final byte[] GPS_PAYLOAD =
            "Exif\0\0GPS 37.5 127.0".getBytes(StandardCharsets.US_ASCII);

    @Nested
    class 판정 {
        @Test
        void 앞_바이트로_형식을_고른다() {
            assertThat(ImageSanitizer.detect(bytes(0xFF, 0xD8, 0xFF, 0xE0)))
                    .contains(ImageFormat.JPEG);
            assertThat(ImageSanitizer.detect(bytes(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)))
                    .contains(ImageFormat.PNG);
            assertThat(
                            ImageSanitizer.detect(
                                    concat(ascii("RIFF"), bytes(0, 0, 0, 0), ascii("WEBP"))))
                    .contains(ImageFormat.WEBP);
        }

        @Test
        void 이름만_jpg_인_텍스트는_거른다() {
            assertThat(ImageSanitizer.detect(ascii("hello.jpg"))).isEmpty();
            assertThat(ImageSanitizer.detect(new byte[0])).isEmpty();
            assertThat(ImageSanitizer.detect(null)).isEmpty();
        }
    }

    @Nested
    class Jpeg {
        private final byte[] app0 = jpegSegment(0xE0, ascii("JFIF\0"));
        private final byte[] app1 = jpegSegment(0xE1, GPS_PAYLOAD);
        private final byte[] app2 = jpegSegment(0xE2, ascii("ICC_PROFILE\0"));
        private final byte[] app13 = jpegSegment(0xED, ascii("Photoshop 3.0\0"));
        private final byte[] app2Mpf = jpegSegment(0xE2, ascii("MPF\0"));
        private final byte[] app4Samsung = jpegSegment(0xE4, ascii("ssuniqueid"));
        private final byte[] app14 = jpegSegment(0xEE, ascii("Adobe"));
        private final byte[] comment = jpegSegment(0xFE, ascii("comment"));
        private final byte[] dqt = jpegSegment(0xDB, bytes(0, 1, 2, 3));
        private final byte[] sosAndRest =
                concat(
                        bytes(0xFF, 0xDA, 0, 8, 1, 1, 0, 0, 63, 0),
                        bytes(0x12, 0xFF, 0x00, 0x34),
                        bytes(0xFF, 0xD9));

        @Test
        void JFIF_ICC_Adobe_디코딩_테이블만_남고_나머지_APP_과_COM_은_빠진다() {
            byte[] input =
                    concat(
                            bytes(0xFF, 0xD8),
                            app0,
                            app1,
                            app2,
                            app2Mpf,
                            app4Samsung,
                            app13,
                            app14,
                            comment,
                            dqt,
                            sosAndRest);

            byte[] out = ImageSanitizer.strip(input, ImageFormat.JPEG);

            assertThat(out)
                    .isEqualTo(concat(bytes(0xFF, 0xD8), app0, app2, app14, dqt, sosAndRest));
            assertThat(contains(out, "GPS")).isFalse();
            assertThat(contains(out, "ssuniqueid")).isFalse();
            assertThat(contains(out, "ICC_PROFILE")).isTrue();
        }

        @Test
        void EOI_뒤_꼬리_데이터는_버린다() {
            // 갤럭시는 EOI 뒤에 촬영 시각(Image_UTC_Data)·국가코드(MCC_Data)를 붙인다
            byte[] trailer = ascii("Image_UTC_Data1791537689624MCC_Data450");
            byte[] input = concat(bytes(0xFF, 0xD8), app0, dqt, sosAndRest, trailer);

            byte[] out = ImageSanitizer.strip(input, ImageFormat.JPEG);

            assertThat(out).isEqualTo(concat(bytes(0xFF, 0xD8), app0, dqt, sosAndRest));
            assertThat(contains(out, "MCC_Data")).isFalse();
        }

        @Test
        void EOI_없이_끝나면_깨진_파일() {
            byte[] input =
                    concat(
                            bytes(0xFF, 0xD8),
                            app0,
                            bytes(0xFF, 0xDA, 0, 8, 1, 1, 0, 0, 63, 0, 0x12));

            assertThatThrownBy(() -> ImageSanitizer.strip(input, ImageFormat.JPEG))
                    .isInstanceOf(BusinessException.class)
                    .hasMessage("이미지를 읽을 수 없습니다.");
        }

        @Test
        void 두_번_걷어내도_같다() {
            byte[] input = concat(bytes(0xFF, 0xD8), app0, app1, dqt, sosAndRest);

            byte[] once = ImageSanitizer.strip(input, ImageFormat.JPEG);

            assertThat(ImageSanitizer.strip(once, ImageFormat.JPEG)).isEqualTo(once);
        }

        @Test
        void 세그먼트_사이_FF_채움은_허용() {
            byte[] input = concat(bytes(0xFF, 0xD8), bytes(0xFF), app0, sosAndRest);

            assertThat(ImageSanitizer.strip(input, ImageFormat.JPEG))
                    .isEqualTo(concat(bytes(0xFF, 0xD8), app0, sosAndRest));
        }

        @Test
        void 길이가_파일을_넘으면_깨진_파일() {
            byte[] input = concat(bytes(0xFF, 0xD8), bytes(0xFF, 0xE1, 0x7F, 0xFF), ascii("short"));

            assertThatThrownBy(() -> ImageSanitizer.strip(input, ImageFormat.JPEG))
                    .isInstanceOf(BusinessException.class)
                    .hasMessage("이미지를 읽을 수 없습니다.");
        }

        @Test
        void SOS_없이_끝나면_깨진_파일() {
            byte[] input = concat(bytes(0xFF, 0xD8), app0);

            assertThatThrownBy(() -> ImageSanitizer.strip(input, ImageFormat.JPEG))
                    .isInstanceOf(BusinessException.class)
                    .hasMessage("이미지를 읽을 수 없습니다.");
        }
    }

    @Nested
    class Png {
        private final byte[] signature = bytes(0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A);
        private final byte[] ihdr = pngChunk("IHDR", bytes(0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0));
        private final byte[] iccp = pngChunk("iCCP", ascii("icc\0"));
        private final byte[] exif = pngChunk("eXIf", GPS_PAYLOAD);
        private final byte[] text = pngChunk("tEXt", ascii("Comment\0secret"));
        private final byte[] itxt = pngChunk("iTXt", ascii("XML:com.adobe.xmp\0\0\0\0\0<x/>"));
        private final byte[] ztxt = pngChunk("zTXt", ascii("c\0\0"));
        private final byte[] time = pngChunk("tIME", bytes(7, 0xEA, 10, 9, 9, 21, 29));
        private final byte[] idat = pngChunk("IDAT", bytes(0x78, 0x9C, 0x63, 0x00));
        private final byte[] iend = pngChunk("IEND", new byte[0]);

        @Test
        void 메타데이터_청크_다섯만_빠진다() {
            byte[] input = concat(signature, ihdr, exif, iccp, text, itxt, time, idat, ztxt, iend);

            byte[] out = ImageSanitizer.strip(input, ImageFormat.PNG);

            assertThat(out).isEqualTo(concat(signature, ihdr, iccp, idat, iend));
            assertThat(contains(out, "GPS")).isFalse();
        }

        @Test
        void IEND_뒤_쓰레기는_버린다() {
            byte[] input = concat(signature, ihdr, idat, iend, ascii("trailing"));

            assertThat(ImageSanitizer.strip(input, ImageFormat.PNG))
                    .isEqualTo(concat(signature, ihdr, idat, iend));
        }

        @Test
        void 첫_청크가_IHDR_아니면_깨진_파일() {
            byte[] input = concat(signature, idat, iend);

            assertThatThrownBy(() -> ImageSanitizer.strip(input, ImageFormat.PNG))
                    .isInstanceOf(BusinessException.class)
                    .hasMessage("이미지를 읽을 수 없습니다.");
        }

        @Test
        void IEND_없이_잘리면_깨진_파일() {
            byte[] input = concat(signature, ihdr, idat);

            assertThatThrownBy(() -> ImageSanitizer.strip(input, ImageFormat.PNG))
                    .isInstanceOf(BusinessException.class)
                    .hasMessage("이미지를 읽을 수 없습니다.");
        }
    }

    @Nested
    class Webp {
        // VP8X flags: ICC 0x20 | EXIF 0x08 | XMP 0x04
        private final byte[] vp8x = webpChunk("VP8X", bytes(0x2C, 0, 0, 0, 0, 0, 0, 0, 0, 0));
        private final byte[] iccp = webpChunk("ICCP", ascii("icc"));
        private final byte[] vp8 = webpChunk("VP8 ", bytes(1, 2, 3)); // 홀수 길이 → 채움 1바이트
        private final byte[] exif = webpChunk("EXIF", GPS_PAYLOAD);
        private final byte[] xmp = webpChunk("XMP ", ascii("<x:xmpmeta/>"));

        @Test
        void EXIF_XMP_빠지고_VP8X_비트와_RIFF_길이가_맞춰진다() {
            byte[] input = riff(concat(vp8x, iccp, vp8, exif, xmp));

            byte[] out = ImageSanitizer.strip(input, ImageFormat.WEBP);

            byte[] expectedVp8x = webpChunk("VP8X", bytes(0x20, 0, 0, 0, 0, 0, 0, 0, 0, 0));
            assertThat(out).isEqualTo(riff(concat(expectedVp8x, iccp, vp8)));
            assertThat(contains(out, "GPS")).isFalse();
        }

        @Test
        void 단순_형식은_그대로() {
            byte[] input = riff(vp8);

            assertThat(ImageSanitizer.strip(input, ImageFormat.WEBP)).isEqualTo(input);
        }

        @Test
        void RIFF_길이가_파일을_넘으면_깨진_파일() {
            byte[] input = concat(ascii("RIFF"), bytes(0xFF, 0xFF, 0, 0), ascii("WEBP"), vp8);

            assertThatThrownBy(() -> ImageSanitizer.strip(input, ImageFormat.WEBP))
                    .isInstanceOf(BusinessException.class)
                    .hasMessage("이미지를 읽을 수 없습니다.");
        }

        @Test
        void 청크_길이가_파일을_넘으면_깨진_파일() {
            byte[] broken = concat(ascii("EXIF"), bytes(0xFF, 0, 0, 0), bytes(1));
            byte[] input = riff(concat(vp8x, broken));

            assertThatThrownBy(() -> ImageSanitizer.strip(input, ImageFormat.WEBP))
                    .isInstanceOf(BusinessException.class)
                    .hasMessage("이미지를 읽을 수 없습니다.");
        }
    }

    // ---- 조립 도우미 ---------------------------------------------------------------------------

    private static byte[] jpegSegment(int marker, byte[] payload) {
        int length = payload.length + 2;
        return concat(bytes(0xFF, marker, (length >> 8) & 0xFF, length & 0xFF), payload);
    }

    private static byte[] pngChunk(String type, byte[] data) {
        byte[] typeBytes = ascii(type);
        CRC32 crc = new CRC32();
        crc.update(typeBytes);
        crc.update(data);
        long c = crc.getValue();
        return concat(
                u32be(data.length),
                typeBytes,
                data,
                bytes(
                        (int) (c >> 24) & 0xFF,
                        (int) (c >> 16) & 0xFF,
                        (int) (c >> 8) & 0xFF,
                        (int) c & 0xFF));
    }

    private static byte[] webpChunk(String fourCc, byte[] data) {
        byte[] padding = data.length % 2 == 1 ? bytes(0) : new byte[0];
        return concat(ascii(fourCc), u32le(data.length), data, padding);
    }

    private static byte[] riff(byte[] chunks) {
        return concat(ascii("RIFF"), u32le(chunks.length + 4), ascii("WEBP"), chunks);
    }

    private static byte[] u32be(int v) {
        return bytes((v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF);
    }

    private static byte[] u32le(int v) {
        return bytes(v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF);
    }

    private static byte[] ascii(String s) {
        return s.getBytes(StandardCharsets.US_ASCII);
    }

    private static byte[] bytes(int... values) {
        byte[] out = new byte[values.length];
        for (int i = 0; i < values.length; i++) {
            out[i] = (byte) values[i];
        }
        return out;
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] part : parts) {
            out.write(part, 0, part.length);
        }
        return out.toByteArray();
    }

    private static boolean contains(byte[] haystack, String needle) {
        return new String(haystack, StandardCharsets.ISO_8859_1).contains(needle);
    }
}
