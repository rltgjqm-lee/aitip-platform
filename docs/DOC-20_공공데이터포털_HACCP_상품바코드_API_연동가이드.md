# DOC-20. 공공데이터포털 HACCP 상품·바코드 API 연동 가이드

> **문서 상태**: 현행 (로컬 개발 서버 구현 완료 / Cloudflare Pages Functions 운영 이관 미구현)  
> **최종 기준일**: 2026-11-21  
> **대상 독자**: 신규 합류 개발자 및 후속 AI 에이전트

---

## 1. 목적 및 배경

하나로마트·식자재마트 위탁운영 포털(`/mart/`)에서 가공식품 등록 시 상품명, 규격, 제조사, 바코드, 공식 제품 이미지를 수기로 입력하지 않고 **공공데이터포털(data.go.kr) HACCP 공식 DB**에서 조회·자동 채움하기 위한 연동 명세 및 운영 이관 가이드이다.

---

## 2. 공공데이터포털 API 명세 및 키 발급 방법

### 2.1 사용 API 정보
- **포털**: 공공데이터포털 (`https://www.data.go.kr`)
- **서비스명**: 한국식품안전관리인증원 HACCP 인증제품 이미지 정보 (`CertImgListServiceV3`)
- **호출 URL**:
  ```text
  https://apis.data.go.kr/B553748/CertImgListServiceV3/getCertImgListServiceV3
  ```
- **주요 요청 파라미터**:
  - `serviceKey`: 공공데이터포털 발급 인증키 (필수)
  - `returnType=json`
  - `pageNo=1`, `numOfRows=10`
  - `barcode`: 바코드 번호 조회 시 사용 (`encodeURIComponent`)
  - `prdlstNm`: 상품명 검색 시 사용 (`encodeURIComponent`, `barcode` 미입력 시 사용)

### 2.2 인증키(Encoding / Decoding) 설정 주의사항
- 공공데이터포털 마이페이지에서 발급되는 인증키는 **일반 인증키(Encoding)** 와 **일반 인증키(Decoding)** 두 종류가 제공된다.
- 현재 서버 코드(`packages/services/mart-logistics/backend/mart-service.mjs` L1013)는 아래와 같이 `serviceKey`를 **별도 `encodeURIComponent` 없이 그대로 문자열 삽입**한다.
  ```js
  const params = [`serviceKey=${apiKey}`, 'returnType=json', 'pageNo=1', 'numOfRows=10'];
  ```
- 따라서 루트 `.env`의 `HACCP_API_KEY`에는 **URL 인코딩이 완료된 Encoding 키**를 넣어야 이중 인코딩 또는 특수문자 깨짐(`SERVICE_KEY_IS_NOT_REGISTERED_ERROR`)을 방지할 수 있다.
- 반대로 코드에서 `encodeURIComponent(apiKey)`를 사용하도록 변경할 경우에는 **Decoding 키**를 사용해야 한다.

---

## 3. 현재 코드베이스 구현 현황 (로컬 개발 서버)

### 3.1 환경 변수
- 파일: 프로젝트 루트 `.env` (`.gitignore` 대상, 리포지토리에 `.env.example` 파일은 현재 없음)
- 키 이름:
  ```env
  HACCP_API_KEY=<공공데이터포털_일반인증키_Encoding>
  ```
- 동작 조건: `process.env.HACCP_API_KEY`가 비어 있으면 `.env에 HACCP_API_KEY가 설정되어 있지 않습니다.` 오류를 반환한다.

### 3.2 백엔드 서비스 (`mart-service.mjs`)
- 파일: `packages/services/mart-logistics/backend/mart-service.mjs`
- **`searchHaccpProducts({ q = '', barcode = '' })`** (L1010 ~ L1037)
  - `barcode` 또는 `q`(상품명)를 받아 `CertImgListServiceV3/getCertImgListServiceV3` 호출
  - 응답(`json?.body?.items`)을 아래 표준 필드로 정규화하여 반환:
    - `prdlstReportNo`: 품목제조보고번호
    - `name`: `prdlstNm` (상품명)
    - `spec`: `capacity` (규격, 미기재 시 `'-'`)
    - `manufacture`: 제조사
    - `prdkind`: 식품유형
    - `barcode`: `barcode` (`'알수없음'` 문자열인 경우 빈 문자열 `''` 처리)
    - `image_url`: `imgurl1 || imgurl2 || ''`
    - `allergy`: `allergy` (`'알수없음'` 제외)
- **`importExternalImageToMedia({ image_url = '', original_name = 'haccp.jpg' })`** (L1039 ~ L1067)
  - 선택한 HACCP 항목의 외부 `image_url`을 서버에서 직접 `fetch`로 다운로드
  - TypeID 규칙에 따라 `med_...` UID(`generateMediaTypeId()`)를 발급
  - 로컬 미디어 디렉토리(`packages/services/mart-logistics/backend/media/${medId}.${ext}`)에 저장하고 `mart_data.json`의 `media_objects` 배열에 메타데이터(`r2_object_key: mart/${martId}/${medId}.${ext}`, `cdn_url: /mart/media/${medId}.${ext}`) 기록

### 3.3 로컬 개발 서버 API 라우트 (`dev-server.mjs`)
- 파일: `dev-server.mjs` (L2051 ~ L2061)
- `GET /api/mart/haccp/search?q=...&barcode=...` -> `martService.searchHaccpProducts({ q, barcode })`
- `POST /api/mart/haccp/import-image` -> `martService.importExternalImageToMedia(body || {})`

### 3.4 프론트엔드 API 클라이언트 및 UI (`mart-portal`)
- API 모듈: `packages/services/mart-logistics/mart-portal/js/api.js` (L119 ~ L127)
  - `martApi.searchHaccp({ q, barcode })`
  - `martApi.importHaccpImage(payload)`
- UI 모듈: `packages/services/mart-logistics/mart-portal/js/modules/catalog.js` (L827 ~ L875)
  - 일반·신선 상품 등록/수정 화면의 `#btn-haccp-lookup` 클릭 시 `#mp-name`(상품명) 또는 `#mp-barcode`(바코드)를 읽어 HACCP 검색 결과를 `#haccp-lookup-box`에 렌더링
  - 결과 행(`.haccp-pick-row`) 클릭 시 상품명·규격·바코드를 자동 입력하고, `image_url`이 있으면 `martApi.importHaccpImage`를 호출하여 로컬 `/mart/media/med_...` 경로로 변환한 뒤 미리보기(`#mp-img-preview-box`)에 반영

---

## 4. 현행 제약 사항(Gap) 및 운영 환경(Cloudflare) 이관 과제

| 구분 | 현재 상태 | 운영 이관 시 필요 작업 |
| :--- | :--- | :--- |
| **로컬 개발(`dev-server.mjs`)** | 구현 완료 (`.env`의 `HACCP_API_KEY` 사용) | `.env.example`에 `HACCP_API_KEY=` 가이드 라인 추가 권장 |
| **Cloudflare Pages Functions (`functions/api/`)** | **미구현** (`/api/mart/haccp/*` 라우트 없음) | `functions/api/mart/[[route]].js` 등 운영 API 핸들러에 `/api/mart/haccp/search`, `/api/mart/haccp/import-image` 포팅 |
| **운영 시크릿 관리** | **미설정** | `wrangler pages secret put HACCP_API_KEY`로 Cloudflare 환경 시크릿 등록 (`context.env.HACCP_API_KEY` 참조) |
| **이미지 저장소** | 로컬 디스크(`backend/media/`) 저장 | 운영 핸들러에서는 Cloudflare R2 버킷(`r2_object_key`) 업로드 및 `media_objects` D1 테이블 INSERT 연동 필요 |

---

## 5. 빠른 로컬 동작 확인 절차

1. 프로젝트 루트 `.env` 파일에 `HACCP_API_KEY=<Encoding 키>`가 설정되어 있는지 확인한다.
2. `node dev-server.mjs` 실행 후 `http://localhost:8989/mart/` 접속
3. `1. 상품등록 > 일반 · 신선 상품 > + 새 상품 등록`에서 바코드(예: `8801007188225`) 또는 가공식품명 입력 후 HACCP 조회 버튼 클릭
4. 직접 API 테스트:
   ```text
   GET http://localhost:8989/api/mart/haccp/search?q=신라면
   GET http://localhost:8989/api/mart/haccp/search?barcode=8801007188225
   ```
