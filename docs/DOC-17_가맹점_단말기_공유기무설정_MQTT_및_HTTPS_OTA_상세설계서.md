# 📟 [DOC-17] 가맹점 엣지 단말기 공유기 무설정(Zero-Config) 아웃바운드 MQTT 및 HTTPS 무결성 OTA 통신 상세설계서

> **문서 식별자:** `AITIP-PILLAR02-EDGE-MQTT-OTA-2026-V01`  
> **버전:** `1.0.0 (Zero-Config NAT & Universal POS-CID Bridge)`  
> **작성일자:** 2026년 11월 12일  
> **표준 런타임:** Cloudflare Workers (API/D1) + 외부 독립 브로커 (EMQX v5 MQTTS 8883 / WSS 443) + Edge Client (MQTT.js / paho-mqtt)  
> **현장 하드웨어:** AITIP 유니버설 컨트롤러 (무화면 Headless 및 화면 탑재형 Display POS 공용) + 기존 매장 윈도우 포스(POS) PC  
> **연관 문서:** `AITIP_PLATFORM_MASTER_DESIGN_2026.md`, `DOC-00`, `DOC-02`, `DOC-05`, `DOC-14`, `BENCHMARK_5_OPENSOURCE_CODE_ANALYSIS.md`

---

## 🕊️ 우리의 핵심 신조 (The Core Creed)
> **"아무리 좋은 코딩이라도 신뢰가 바탕이 되지 않으면 아무 소용이 없다.**  
> **한 달에 수십만 원, 수백만 원씩 영세 상인의 피를 빨아먹는 약탈적 독점 플랫폼이 아니라, 세상에 진정으로 도움이 되고 온기를 더하는 상생 플랫폼을 만든다.**  
> **이를 실현하기 위해 단말기는 매장의 복잡한 공유기 환경을 0.001%도 건드리지 않고 꽂기만 하면 즉시 작동해야 하며,**  
> **기존 포스 프로그램과 매끄럽게 상생 연동되는 완벽한 신뢰성과 보안성을 갖추어야 한다."**

---

## 1. 설계 철학 및 '공유기 설정 제로(Zero-Config)' 대원칙

영세 식당, 골목 상점, 단위농협 마트는 통신사 모뎀, 저가형 공유기(iptime 등), 이중 NAT, 사설 유동 IP 환경이 대다수입니다. 현장 기사가 방문하여 포트포워딩, DDNS, DMZ, UPnP 설정을 요구하는 장비는 매장 공유기 교체나 통신사 AS 시 100% 장애를 유발합니다.

따라서 AITIP 엣지 시스템은 **"100% 아웃바운드 전용(Outbound-Only) 무설정 통신"**을 절대 철칙으로 규정합니다.

### 1.1 인바운드 개방 0% (Zero Inbound Listening Port)
* 단말기는 외부 공인망을 향해 열어두는 리스닝 포트(Inbound Port)가 단 1개도 존재하지 않습니다 (SSH, HTTP, Telnet 포트 완전 차단).
* 외부 포트 스캐너(Shodan, nmap 등)로 매장 공인 IP를 검색해도 단말기의 존재 자체를 탐지할 수 없으므로, **원격 포트 침투 공격면(Attack Surface)이 100% 원천 제거**됩니다.

### 1.2 아웃바운드 전용(Outbound-Only) 세션 수립
* 단말기에 전원이 인가되면, 단말기가 클라우드 브로커를 향해 **내부에서 외부로 나가는(Outbound) TCP 세션**을 먼저 수립합니다.
* 모든 상용 공유기 및 방화벽은 내부에서 외부로 나가는 세션을 기본 허용하므로, 공유기 설정을 단 1비트도 수정할 필요가 없습니다.
* 세션이 수립되면 공유기 내부의 상태 추적 NAT 테이블(Stateful NAT Table)이 유지되므로, 클라우드 서버는 이 연결 터널을 통해 가맹점 단말기로 0.01초 만에 주문과 제어 신호를 양방향 전송합니다.

---

## 2. 포트 443 (WSS) / 포트 8883 (MQTTS) 이중화 및 NAT 타임아웃 방지

일부 대형 프랜차이즈, 백화점 입점 매장, 공공기관 네트워크는 보안 방화벽이 엄격하여 비표준 포트(8883 등)를 차단하는 경우가 있습니다.

### 2.1 포트 443 (MQTTS over WSS) 자동 폴백 메커니즘
* **1차 접속 시도**: 표준 MQTTS 포트 `TCP 8883` (Let's Encrypt TLS 1.3 암호화).
* **2차 자동 폴백**: 방화벽 등으로 8883 핸드셰이크가 3초 내 실패할 경우, 즉시 **포트 443 WebSocket 보안 터널 (`wss://broker.aitip.kr:8084/mqtt` 또는 443 역방향 프록시)**로 자동 전환.
* **효과**: 포트 443은 일반 웹 브라우징(HTTPS)과 동일한 포트이므로, 전 세계 어떤 극단적인 방화벽 환경에서도 100% 무통과 개통됩니다.

### 2.2 NAT 타임아웃 방지: 30초 Smart Keep-Alive
* 저가형 공유기는 유휴 연결을 60~120초 만에 강제 종료하여 연결이 끊어지는 현상(NAT Timeout)이 발생합니다.
* 단말기 트랜스포트 계층은 **30초 주기 초경량 PINGREQ(단 2바이트)**를 발송하고 브로커로부터 `PINGRESP`를 수신합니다.
* 이로 인해 공유기의 NAT 매핑이 영구히 갱신되며, 한 달 내내 켜두어도 발생하는 트래픽은 수 메가바이트(MB)에 불과합니다.

---

## 3. MQTT와 HTTPS의 엄격한 역할 분리 원칙 (제어 평면 vs 데이터 평면)

글로벌 IoT 아키텍처 원칙에 따라, 대용량 바이너리를 가벼운 메시징 브로커에 직접 실어 보내는 무모한 방식을 원천 금지합니다.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   AITIP 엣지 ↔ 클라우드 프로토콜 역할 분리                      │
├────────────────────────┬─────────────────────────────┬───────────────────────────┤
│ 구분                   │ 제어 평면 (Control Plane)   │ 데이터 평면 (Data Plane)  │
├────────────────────────┼─────────────────────────────┼───────────────────────────┤
│ **프로토콜**           │ **MQTT (MQTTS 8883 / WSS)** │ **HTTPS (TLS 1.3 / CDN)** │
├────────────────────────┼─────────────────────────────┼───────────────────────────┤
│ **전송 데이터**        │ • 실시간 신규 주문 알림    │ • OTA 펌웨어 바이너리(.bin)│
│                        │ • CTI 전화 인입 발신번호    │ • 매장 알림 음원(.wav/.mp3)│
│                        │ • 60초 주기 헬스체크        │ • 가맹점 대형 메뉴/설정JSON│
│                        │ • **OTA 다운로드 트리거**   │                           │
├────────────────────────┼─────────────────────────────┼───────────────────────────┤
│ **핵심 특성**          │ QoS 1 신뢰 보장, 10ms 지연  │ 대역폭 최적화, 무결성 검증│
│                        │ 수 KB 이하 초경량 페이로드  │ SHA256 해시 대조, 무단절  │
└────────────────────────┴─────────────────────────────┴───────────────────────────┘
```

---

## 4. 단말기 인증 및 엄격한 토픽 격리 ACL (도청·위변조 차단)

타 매장의 주문 내역이나 고객의 전화번호가 도청(Sniffing)되는 행위를 원천 차단하기 위해 단말기별 인증 및 ACL(Access Control List)을 강제합니다.

### 4.1 기기 인증 규격
* **Username**: 단말기 고유 UID (`dev_01m6z4term8923`, TypeID 규격)
* **Password**: 공장 출하 시 하드웨어 보안 영역(Keystore)에 주입되고 클라우드 D1 DB의 `devices.secret_hash`와 대조되는 HMAC-SHA256 사전 공유 키(PSK).

### 4.2 매장별 토픽 격리 매트릭스
| 토픽 패턴 | 접근 권한 | 패킷 용도 및 페이로드 |
| :--- | :---: | :--- |
| `aitip/stores/{storeId}/orders` | **Subscribe Only** | 해당 매장의 신규 주문 수신 전용 |
| `aitip/devices/{deviceId}/config` | **Subscribe Only** | 원격 음량/인쇄 매수/설정 동기화 (Retained) |
| `aitip/update/request/{deviceId}` | **Subscribe Only** | 펌웨어/음원 OTA 다운로드 지시 트리거 |
| `aitip/devices/{deviceId}/telephony`| **Publish Only** | 전화선 CTI 링 감지 및 발신번호 클라우드 보고 |
| `aitip/devices/{deviceId}/status` | **Publish Only** | 60초 주기 헬스체크 및 OTA 결과 보고 |

---

## 5. 유니버설 엣지 단말기 OTA 및 기존 포스(POS) CID 연동 아키텍처

화면이 탑재된 단말기든, 화면이 없는 헤드리스 단말기든 관계없이 **서버 기반 상태 추적과 기존 포스 연동 브리지는 유니버설(Universal)하게 동일한 로직으로 가동**됩니다.

### 5.1 유니버설 OTA 무결성 파이프라인 (화면 유/무 공통)
모든 단말기는 화면 유무에 의존하지 않고 다음 파이프라인을 엄격히 준수합니다:

1. **MQTT 제어 트리거 수신**:
   `aitip/update/request/{deviceId}` 토픽으로 수신:
   ```json
   {
     "content_type": "firmware",
     "target": "system",
     "version": "1.4.2",
     "download_url": "https://cdn.aitip.kr/firmware/aitip-v1.4.2.bin",
     "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
     "hw_rev": "V3S_REV_B"
   }
   ```
2. **HW Revision 호환성 가드 검사**:
   단말기 자체의 하드웨어 리비전과 일치하지 않으면 즉시 차단하고 서버로 거부 사유 보고.
3. **HTTPS 스트림 다운로드**:
   `download_url`로 안전한 TLS 1.3 스트림 다운로드 수행.
4. **SHA256 암호학적 무결성 검증**:
   다운로드된 임시 파일의 해시를 직접 계산하여 서버가 서명한 `sha256`과 1비트 단위까지 대조. 불일치 시 파일 즉시 삭제.
5. **서버 기반 상태 보고 (Server-based Tracking)**:
   화면을 사람이 보고 있지 않더라도 서버가 디바이스 상태를 즉시 알 수 있도록 결과 JSON 전송:
   ```json
   {
     "device_id": "dev_01m6z4term8923",
     "content_type": "firmware",
     "target": "system",
     "result": "success",
     "version": "1.4.2",
     "error_code": "0x00"
   }
   ```

### 5.2 화면 탑재형 vs 무화면(Headless) 현장 피드백 분기
* **화면이 있는 경우 (Display POS / 태블릿 일체형)**:
  - 화면 상단에 다운로드 진행률(%), 무결성 검증 상태, 버전 안내 HUD 오버레이 표출.
  - 전화 인입 시 화면 전체에 고객 팝업(단골 뱃지, 최근 주문, 선호 메뉴) 표출.
* **화면이 없는 경우 (Headless Controller)**:
  - 피에조 부저 사운드 코드 피드백 (OTA 성공: 2회 딩-동 / 실패: 5회 단속음).
  - 하드웨어 이중화(A/B 파티션)를 통해 부팅 실패 시 이전 안정 버전 커널로 자동 무단절 롤백.

### 5.3 기존 매장 포스(POS) 프로그램 발신번호(CID) 연동 엔진 (핵심)
화면 유무와 관계없이, 매장 카운터의 기존 윈도우 포스(오케이포스, 이지포스, 포스뱅크 등)에서 고객 전화를 그대로 접수할 수 있도록 **단말기가 가상 CID 하드웨어로 동작**합니다.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   AITIP 엣지 ➔ 기존 윈도우 포스(POS) CID 연동 흐름              │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 1. [매장 유선 전화선(RJ11 / SIP)] ➔ 인바운드 링 감지 및 발신번호(CID) 추출     │
│ 2. [AITIP 엣지 단말기 본체]                                                     │
│    ├─ (A) USB 케이블 ➔ 포스 PC의 가상 시리얼 포트(COM3~COM9 / CDC-ACM)         │
│    │      • 한국 포스 표준 CID 프로토콜 (ASCII: [STX]01012345678[ETX]) 전송     │
│    │      • 기존 오케이포스/이지포스 화면에 즉시 "전화 주문 팝업" 자동 호출      │
│    ├─ (B) 로컬 루프백 소켓 (127.0.0.1:9099) ➔ 웹 포스 및 클라우드 포스 브리지   │
│    └─ (C) 클라우드 MQTTS 브로드캐스트 ➔ 주방 태블릿 PWA 및 사장님 모바일 팝업   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

1. **USB 가상 시리얼 포트(CDC-ACM) 에뮬레이션**:
   - 단말기가 윈도우 포스 PC의 USB 포트에 연결되면 표준 직렬 통신 포트(`COMx`)로 인식됩니다.
   - 단말기는 시중의 유선 CID 장비(벨소리, 콜박스 등)와 동일한 **표준 CID ASCII 스트림**을 포스 프로그램으로 밀어 넣습니다.
   - 사장님은 기존에 쓰시던 포스 프로그램 설정을 바꿀 필요 없이, 전화 인입 시 기존 화면에서 고객 팝업을 즉시 보게 됩니다.
2. **트리플 브로드캐스트 (Triple Broadcast)**:
   - 전화 인입 1건 발생 시: **[기존 카운터 포스] + [주방 벽걸이 태블릿 PWA] + [사장님 스마트폰]** 3곳에 0.01초 만에 동시 알림이 전달됩니다.

---

## 6. Cloudflare Workers ↔ 외부 EMQX v5 브로커 양방향 통신 명세

### 6.1 하향 주문 푸시 파이프라인 (Workers ➔ EMQX REST API)
고객이 PWA에서 주문 결제를 마치면, Cloudflare Workers는 D1에 주문을 트랜잭션 기록한 직후 다음 API를 호출합니다:
* **Endpoint**: `POST https://broker.aitip.kr:18083/api/v5/publish`
* **Headers**:
  ```http
  Authorization: Basic <EMQX_API_CREDENTIALS>
  Content-Type: application/json
  ```
* **Payload**:
  ```json
  {
    "topic": "aitip/stores/str_01h7x8q4barunchicken001/orders",
    "qos": 1,
    "retain": false,
    "payload": "{\"order_id\":\"ord_01m6wzpjfnfwh9j4zetc21ates\",\"short_display_id\":\"A-12\",\"fulfillment_type\":\"DELIVERY\",\"total_amount\":42800,\"items\":[{\"name\":\"현미바삭치킨\",\"qty\":1,\"price\":18900}]}"
  }
  ```

### 6.2 상향 보고 파이프라인 (EMQX Rule Engine ➔ Workers Webhook)
단말기가 올리는 CTI 발신번호 및 LWT(비정상 접속 끊김)는 EMQX 룰 엔진을 통해 Workers로 전달됩니다:
* **EMQX Rule SQL**:
  ```sql
  SELECT clientid, topic, payload, timestamp FROM "aitip/devices/+/telephony"
  ```
* **Workers 수신**: `POST https://api.aitip.kr/api/edge/telephony-webhook`
  - D1 DB `telephony_logs` 테이블에 무결성 기록 ➔ CRM 연동.

---

## 7. 단말기 로컬 오프라인 큐 및 WAL 디스크 스토어 설계

가맹점 인터넷이 일시 단절되더라도 주문 인쇄나 CTI 이벤트가 증발하지 않도록 디스크 영속화를 강제합니다.

* **인메모리 큐의 위험성 차단**: `MQTT.js` 기본 인메모리 큐 대신, SQLite 또는 NeDB 기반의 **Write-Ahead Log (WAL) 디스크 스토어**를 `incomingStore` / `outgoingStore`에 장착.
* **QoS 1 재전송 보장**: 인터넷이 복구되는 순간, 미확인된 영수증 인쇄 패킷과 전화 수신 로그가 1건의 유실도 없이 완벽히 동기화됩니다.

---

## 8. 수만 대 가맹점 수용을 위한 모노레포(`packages/edge-device`) 모듈 규격

```
packages/edge-device/
├── transport-client/       # MQTTS 8883 / Port 443 WSS 클라이언트, 자동 재연결, 오프라인 WAL
├── ota/                    # HTTPS 다운로더, SHA256 체크섬 무결성 검증기, A/B 롤백 제어기
├── print-spooler/          # ESC/POS 바이트 스트림 생성기 및 USB /dev/usb/lp0 직결 인쇄
├── cti-driver/             # 전화선 링 감지, CID 추출, USB 가상 COM 포트 에뮬레이터 (CDC-ACM)
└── tools/device-simulator/ # PC 환경에서 가상 단말기로 주문 수신, 포스 연동, OTA 검증하는 도구
```

---

## 9. 결론 및 향후 구현 체크리스트

본 설계서는 **"가맹점 현장 공유기 영향 제로(Zero-Config) + 최고 수준의 TLS/ACL 보안 + 기존 윈도우 포스 완벽 연동"**이라는 상생 플랫폼의 대전제를 충족하는 기술적 헌장입니다.

- [x] 공유기 영향 제로 (인바운드 0%, 아웃바운드 100%) 원칙 수립
- [x] 포트 443 WSS / 8883 MQTTS 2중화 및 30초 Smart Keep-Alive 규격화
- [x] MQTT 제어 평면과 HTTPS 데이터 평면(OTA)의 완전 분리
- [x] 화면 유/무 공통 100% 서버 기반 상태 보고(Server-based Tracking)
- [x] 기존 윈도우 포스(POS) 프로그램을 위한 USB 가상 시리얼(CDC-ACM) CID 연동 규격화
- [x] Cloudflare Workers ↔ EMQX v5 REST/Webhook 브리지 명세 완성
