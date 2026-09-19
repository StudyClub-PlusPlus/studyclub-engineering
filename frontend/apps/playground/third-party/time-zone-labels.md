# 시간대 표시 이름 출처

`src/proto/core/lib/time-zone-labels.json`은 아래 공개 데이터를 조합해 만든 정적 한국어·영어 표시 이름입니다. 화면 로딩 시 외부 요청이나 새 라이브러리 설치는 필요하지 않습니다.

- [Unicode CLDR JSON 48.0.0](https://github.com/unicode-org/cldr-json/tree/48.0.0/cldr-json): `cldr-dates-full/main/{ko,en}/timeZoneNames.json`의 `exemplarCity`, `cldr-localenames-full/main/{ko,en}/territories.json`의 국가·지역명, `cldr-core/supplemental/aliases.json`의 `zoneAlias`를 사용합니다.
- [IANA tz 2025b zone.tab](https://github.com/eggert/tz/blob/2025b/zone.tab): 시간대와 국가·지역 코드의 연결에 사용합니다.
- [IANA tz 2025b backward](https://github.com/eggert/tz/blob/2025b/backward): 이전 시간대 이름과 현재 이름을 연결합니다. 이 두 IANA 파일은 각 파일의 명시대로 public domain입니다.
- Unicode 데이터 라이선스는 같은 폴더의 `UNICODE-LICENSE.txt`에 포함합니다.

생성 규칙: CLDR 도시 이름을 시간대 ID별로 펼친 뒤, `zone.tab`의 국가·지역 코드를 번역 이름과 조합합니다. 직접 일치하는 도시 이름이 있으면 우선하며, 이전 이름은 별칭 연결을 따라 해당 도시의 번역을 찾습니다. 영어의 US·UK는 United States·United Kingdom으로 풀어 쓰고, UTC는 별도로 표시합니다. 번역 데이터 갱신 시 브라우저가 제공하는 전체 시간대 목록의 한국어 이름 누락 여부를 확인해야 합니다.

이 데이터는 표시 이름만 제공합니다. 선택 가능한 시간대, 현재 시차와 서머타임은 브라우저의 `Intl`이 판단하고, 저장값은 IANA ID를 유지합니다. 화면은 해당 언어의 국가·도시명과 UTC 시차를 보여주며, 한국어·영어 이름과 IANA ID 모두로 검색할 수 있습니다.
