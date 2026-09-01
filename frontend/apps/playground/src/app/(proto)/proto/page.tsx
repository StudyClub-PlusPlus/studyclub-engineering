import { redirect } from 'next/navigation';

/**
 * `/proto` 는 목록을 보여주지 않고 **사이트 첫 화면으로 그냥 들어간다.**
 *
 * 목록 페이지를 두면 보는 사람이 실제로는 존재하지 않는 화면(색인)을 한 번 거치게 된다.
 * 프로토의 목적은 실제 동선을 그대로 겪어 보는 것이라, 진입도 실제와 같아야 한다.
 * 화면 이동은 사이트의 진짜 Nav 와 상단 바의 사용자 사이트 · 운영 콘솔 전환으로 한다.
 */
export default function ProtoEntry() {
  redirect('/proto/core/ko');
}
