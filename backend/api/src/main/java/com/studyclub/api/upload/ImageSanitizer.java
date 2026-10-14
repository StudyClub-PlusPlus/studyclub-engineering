package com.studyclub.api.upload;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Optional;
import java.util.Set;

/**
 * 형식 판정과 메타데이터 제거. 픽셀은 건드리지 않고 메타데이터 부분만 걷어낸다 — 재압축이 없어 화질이 그대로고 라이브러리도 필요 없다.
 *
 * <p>지우는 이유: 폰 사진의 EXIF 에는 촬영 위치(GPS)·시각·기기 모델이 들어 있다. {@code gigs/} 는 공개 폴더라 그대로 저장하면 주소만 알면 위치까지
 * 읽힌다.
 *
 * <p>형식별로 지우는 부분 (specs/profile-image/spec.md 결정 5):
 *
 * <ul>
 *   <li>jpeg — 남기는 목록 방식. {@code APP0}(JFIF) · {@code APP2} 중 ICC 색 프로필 · {@code APP14}(Adobe 색변환)
 *       · 디코딩 테이블(DQT · DHT · SOF · DRI)만 남기고 다른 {@code APPn} 과 {@code COM} 은 전부 뺀다. {@code EOI} 뒤에
 *       붙은 데이터도 버린다. 지우는 목록으로 하면 갤럭시가 EXIF 밖({@code APP4}, {@code EOI} 뒤 꼬리)에 넣는 센서 고유 ID · 촬영 시각 ·
 *       국가코드가 남는다 — 갤럭시 S25+ 실사진으로 확인
 *   <li>png — {@code eXIf} · {@code tEXt} · {@code iTXt} · {@code zTXt} · {@code tIME} 청크. {@code
 *       iCCP} 는 남긴다
 *   <li>webp — {@code EXIF} · {@code XMP } 청크. {@code VP8X} 의 EXIF·XMP 비트를 끄고 {@code RIFF} 길이를 다시
 *       쓴다. {@code ICCP} 는 남긴다
 * </ul>
 *
 * <p>구조가 어긋나면(길이가 파일을 넘는 등) 400 「이미지를 읽을 수 없습니다.」 깨진 채로 저장하지 않는다.
 */
public final class ImageSanitizer {

    private ImageSanitizer() {}

    /** 맨 앞 바이트로 판정한다. 셋 다 아니면 비어 있다. */
    public static Optional<ImageFormat> detect(byte[] bytes) {
        if (bytes == null) {
            return Optional.empty();
        }
        if (startsWith(bytes, 0, 0xFF, 0xD8, 0xFF)) {
            return Optional.of(ImageFormat.JPEG);
        }
        if (startsWith(bytes, 0, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)) {
            return Optional.of(ImageFormat.PNG);
        }
        if (bytes.length >= 12
                && startsWith(bytes, 0, 'R', 'I', 'F', 'F')
                && startsWith(bytes, 8, 'W', 'E', 'B', 'P')) {
            return Optional.of(ImageFormat.WEBP);
        }
        return Optional.empty();
    }

    public static byte[] strip(byte[] bytes, ImageFormat format) {
        try {
            return switch (format) {
                case JPEG -> stripJpeg(bytes);
                case PNG -> stripPng(bytes);
                case WEBP -> stripWebp(bytes);
            };
        } catch (IndexOutOfBoundsException | IllegalStateException e) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "이미지를 읽을 수 없습니다.");
        }
    }

    // ---- jpeg -------------------------------------------------------------------------------

    private static final int JPEG_SOI = 0xD8;
    private static final int JPEG_EOI = 0xD9;
    private static final int JPEG_SOS = 0xDA;
    private static final int JPEG_APP0 = 0xE0;
    private static final int JPEG_APP2 = 0xE2;
    private static final int JPEG_APP14 = 0xEE;
    private static final int JPEG_APP15 = 0xEF;
    private static final int JPEG_COM = 0xFE;
    private static final byte[] ICC_PROFILE_TAG =
            "ICC_PROFILE\0".getBytes(StandardCharsets.US_ASCII);

    /**
     * SOI 뒤에 「FF 마커 + 2바이트 길이 + 본문」 세그먼트가 이어지다가 SOS 가 나오면 그 뒤는 압축 데이터다. SOS 부터 EOI 까지는 그대로 복사한다 —
     * 압축 데이터 안에는 메타데이터가 없고, 압축 데이터 안의 FF 뒤에는 00 이나 D0~D7 만 오므로 첫 FF D9 가 EOI 다. EOI 뒤는 버린다.
     */
    private static byte[] stripJpeg(byte[] bytes) {
        ByteArrayOutputStream out = new ByteArrayOutputStream(bytes.length);
        out.write(bytes, 0, 2); // SOI
        int pos = 2;
        while (true) {
            // 세그먼트 사이의 FF 채움 바이트는 허용한다
            while (pos < bytes.length && (bytes[pos] & 0xFF) == 0xFF) {
                pos++;
            }
            if (pos >= bytes.length) {
                throw new IllegalStateException("SOS 없이 끝남");
            }
            int marker = bytes[pos] & 0xFF;
            if (marker == JPEG_SOS) {
                // SOS 부터 EOI 까지 통째로. EOI 뒤 꼬리(갤럭시 촬영 시각·국가코드, 모션 포토 동영상)는 버린다
                int eoi = findEoi(bytes, pos);
                out.write(0xFF);
                out.write(bytes, pos, eoi + 2 - pos);
                return out.toByteArray();
            }
            if (marker == JPEG_EOI
                    || marker == JPEG_SOI
                    || (marker >= 0xD0 && marker <= 0xD7)
                    || marker == 0x01) {
                // 길이 없는 마커가 SOS 전에 나오면 구조가 이상한 파일
                throw new IllegalStateException("SOS 전에 단독 마커 " + marker);
            }
            int length = readU16BE(bytes, pos + 1);
            if (length < 2 || pos + 1 + length > bytes.length) {
                throw new IllegalStateException("세그먼트 길이가 파일을 넘음");
            }
            if (keepJpegSegment(marker, bytes, pos + 3, length - 2)) {
                out.write(0xFF);
                out.write(bytes, pos, 1 + length);
            }
            pos += 1 + length;
        }
    }

    /** 남기는 목록 — 디코딩과 색에 필요한 것만. 나머지 APPn(EXIF · XMP · IPTC · 제조사 전용 등)과 COM 은 전부 뺀다. */
    private static boolean keepJpegSegment(
            int marker, byte[] bytes, int payloadPos, int payloadLength) {
        if (marker == JPEG_COM) {
            return false;
        }
        if (marker < JPEG_APP0 || marker > JPEG_APP15) {
            return true; // DQT · DHT · SOF · DRI 같은 디코딩 마커
        }
        if (marker == JPEG_APP0 || marker == JPEG_APP14) {
            return true; // JFIF · Adobe 색변환 정보
        }
        if (marker == JPEG_APP2) {
            // APP2 는 ICC 색 프로필만. 같은 APP2 를 쓰는 MPF(멀티 픽처)는 EOI 뒤 데이터를 가리키므로 같이 뺀다
            return payloadLength >= ICC_PROFILE_TAG.length
                    && Arrays.equals(
                            bytes,
                            payloadPos,
                            payloadPos + ICC_PROFILE_TAG.length,
                            ICC_PROFILE_TAG,
                            0,
                            ICC_PROFILE_TAG.length);
        }
        return false;
    }

    /** SOS 위치부터 첫 {@code FF D9}. 없으면 깨진 파일. */
    private static int findEoi(byte[] bytes, int from) {
        for (int i = from; i + 1 < bytes.length; i++) {
            if ((bytes[i] & 0xFF) == 0xFF && (bytes[i + 1] & 0xFF) == JPEG_EOI) {
                return i;
            }
        }
        throw new IllegalStateException("EOI 없이 끝남");
    }

    // ---- png --------------------------------------------------------------------------------

    private static final int PNG_SIGNATURE_LENGTH = 8;
    private static final Set<String> PNG_DROP = Set.of("eXIf", "tEXt", "iTXt", "zTXt", "tIME");

    /**
     * 서명 8바이트 뒤에 「4바이트 길이 + 4바이트 타입 + 본문 + 4바이트 CRC」 청크가 IEND 까지 이어진다. 청크를 통째로 빼므로 CRC 는 그대로 맞다.
     */
    private static byte[] stripPng(byte[] bytes) {
        ByteArrayOutputStream out = new ByteArrayOutputStream(bytes.length);
        out.write(bytes, 0, PNG_SIGNATURE_LENGTH);
        int pos = PNG_SIGNATURE_LENGTH;
        boolean first = true;
        while (true) {
            if (pos + 8 > bytes.length) {
                throw new IllegalStateException("IEND 없이 끝남");
            }
            long length = readU32BE(bytes, pos);
            String type = new String(bytes, pos + 4, 4, StandardCharsets.US_ASCII);
            long chunkEnd = pos + 12 + length;
            if (chunkEnd > bytes.length) {
                throw new IllegalStateException("청크 길이가 파일을 넘음");
            }
            if (first && !type.equals("IHDR")) {
                throw new IllegalStateException("첫 청크가 IHDR 이 아님");
            }
            first = false;
            if (!PNG_DROP.contains(type)) {
                out.write(bytes, pos, (int) (chunkEnd - pos));
            }
            pos = (int) chunkEnd;
            if (type.equals("IEND")) {
                return out.toByteArray();
            }
        }
    }

    // ---- webp -------------------------------------------------------------------------------

    private static final int WEBP_HEADER_LENGTH = 12;
    private static final Set<String> WEBP_DROP = Set.of("EXIF", "XMP ");
    private static final int VP8X_FLAG_EXIF = 0x08;
    private static final int VP8X_FLAG_XMP = 0x04;

    /**
     * {@code RIFF <길이> WEBP} 뒤에 「4바이트 이름 + 4바이트 길이(LE) + 본문 + 홀수면 채움 1바이트」 청크가 이어진다. 확장 형식은 첫 청크가
     * {@code VP8X} 이고 거기 어떤 청크가 있는지 비트로 적혀 있어, EXIF·XMP 를 빼면 그 비트도 꺼야 디코더가 찾다가 실패하지 않는다.
     */
    private static byte[] stripWebp(byte[] bytes) {
        if (bytes.length < WEBP_HEADER_LENGTH) {
            throw new IllegalStateException("RIFF 머리글이 없음");
        }
        long riffSize = readU32LE(bytes, 4);
        if (riffSize + 8 > bytes.length) {
            throw new IllegalStateException("RIFF 길이가 파일을 넘음");
        }
        int end = (int) (riffSize + 8); // RIFF 길이 뒤에 붙은 쓰레기 바이트는 버린다
        ByteArrayOutputStream body = new ByteArrayOutputStream(bytes.length);
        int pos = WEBP_HEADER_LENGTH;
        while (pos < end) {
            if (pos + 8 > end) {
                throw new IllegalStateException("청크 머리글이 잘림");
            }
            String fourCc = new String(bytes, pos, 4, StandardCharsets.US_ASCII);
            long length = readU32LE(bytes, pos + 4);
            long padded = length + (length % 2);
            long chunkEnd = pos + 8 + padded;
            if (pos + 8 + length > end) {
                throw new IllegalStateException("청크 길이가 파일을 넘음");
            }
            // 마지막 청크의 채움 바이트가 빠진 파일도 있다 — 본문까지만 있으면 받는다
            int copyEnd = (int) Math.min(chunkEnd, end);
            if (!WEBP_DROP.contains(fourCc)) {
                byte[] chunk = Arrays.copyOfRange(bytes, pos, copyEnd);
                if (fourCc.equals("VP8X") && length >= 1) {
                    chunk[8] = (byte) (chunk[8] & ~(VP8X_FLAG_EXIF | VP8X_FLAG_XMP));
                }
                body.write(chunk, 0, chunk.length);
            }
            pos = copyEnd;
        }
        byte[] bodyBytes = body.toByteArray();
        ByteArrayOutputStream out =
                new ByteArrayOutputStream(bodyBytes.length + WEBP_HEADER_LENGTH);
        out.write(bytes, 0, 4); // RIFF
        writeU32LE(out, bodyBytes.length + 4); // 길이 = WEBP 4바이트 + 청크들
        out.write(bytes, 8, 4); // WEBP
        out.write(bodyBytes, 0, bodyBytes.length);
        return out.toByteArray();
    }

    // ---- bytes ------------------------------------------------------------------------------

    private static boolean startsWith(byte[] bytes, int offset, int... expected) {
        if (bytes.length < offset + expected.length) {
            return false;
        }
        for (int i = 0; i < expected.length; i++) {
            if ((bytes[offset + i] & 0xFF) != expected[i]) {
                return false;
            }
        }
        return true;
    }

    private static int readU16BE(byte[] bytes, int pos) {
        return ((bytes[pos] & 0xFF) << 8) | (bytes[pos + 1] & 0xFF);
    }

    private static long readU32BE(byte[] bytes, int pos) {
        return ((long) (bytes[pos] & 0xFF) << 24)
                | ((long) (bytes[pos + 1] & 0xFF) << 16)
                | ((long) (bytes[pos + 2] & 0xFF) << 8)
                | (bytes[pos + 3] & 0xFF);
    }

    private static long readU32LE(byte[] bytes, int pos) {
        return ((long) (bytes[pos + 3] & 0xFF) << 24)
                | ((long) (bytes[pos + 2] & 0xFF) << 16)
                | ((long) (bytes[pos + 1] & 0xFF) << 8)
                | (bytes[pos] & 0xFF);
    }

    private static void writeU32LE(ByteArrayOutputStream out, long value) {
        out.write((int) (value & 0xFF));
        out.write((int) ((value >> 8) & 0xFF));
        out.write((int) ((value >> 16) & 0xFF));
        out.write((int) ((value >> 24) & 0xFF));
    }
}
