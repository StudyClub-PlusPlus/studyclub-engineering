/**
 * apply=1 복귀 시 내 신청 조회를 기다릴지.
 * 로그인 사용자인데 조회가 끝나기 전에 의도를 소비하면, myApp 갱신으로 effect 가
 * 재실행·cancel 되고 신청 버튼이 로딩에 갇힐 수 있다 (#376 리뷰).
 */
export function shouldWaitForMyApplication(isUser: boolean, myAppFetched: boolean): boolean {
  return isUser && !myAppFetched;
}
