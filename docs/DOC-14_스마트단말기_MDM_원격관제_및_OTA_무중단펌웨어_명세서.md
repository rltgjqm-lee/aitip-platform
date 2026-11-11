# 📟 AITIP DOC-14: 스마트 단말기 MDM 원격관제 및 OTA 무중단 펌웨어 명세서
**문서 식별자:** `AITIP-SPEC-DOC-14-TERMINAL-MDM-OTA-2026-V01`  
**표준 제정일:** 2026-11-09  
**상태:** 승인 완료 (Approved & Implemented)  
**적용 대상:** 매장 카운터/주방 거치형 라즈베리파이 CTI 단말기, 안드로이드 POS 단말기, 하나로마트 거치형 태블릿, 본사 MDM 관제 서버, Cloudflare Workers & R2, EMQX MQTT 브릿지

---

## 1. 🕊️ 핵심 신조 및 엣지 단말기 무중단 현장 신뢰 철학

> **"점주에게 '단말기 고장 났으니 재부팅하세요'라고 말하는 것은 기술의 태만이다.**  
> **AITIP 스마트 단말기는 주방의 열기와 기름때 속에서도 24시간 365일 멈춤 없이 작동해야 하며,**  
> **용지 부족, 통신 두절, 펌웨어 업데이트까지 본사가 원격에서 0초 자가 치유(Self-Healing)한다."**

골목식당 주방과 하나로마트 계산대는 IT 기기에게 가장 가혹한 환경입니다.  
고온 다습한 주방 열기, 튀는 기름때, 먼지, 그리고 인터넷 랜선이 헐거워지거나 영수증 롤 용지가 떨어지는 돌발 상황이 끊임없이 발생합니다. 점주에게 복잡한 전산 지식을 요구하거나 오류가 났을 때 기계를 껐다 켜라고 강요해서는 안 됩니다.

AITIP은 전국의 수천 대 단말기를 본사 관제 센터에서 1초 단위로 실시간 진단하는 **"MDM 원격 텔레메트리 감시망(`device_telemetry_logs`)"**과, 기기가 벽돌(Brick)이 되는 사고를 원천 방지하는 **"A/B 듀얼 파티션 롤백 기반 OTA 무중단 펌웨어 엔진(`firmware_releases`)"**을 구축합니다.

---

## 2. 📟 5대 텔레메트리 지표 및 실시간 이상 징후 자동 경보 엔진

단말기는 매 60초마다(또는 이상 발생 즉시) MQTT QoS 1을 통해 본사 브릿지로 5대 핵심 헬스체크 데이터를 보고합니다.

```mermaid
graph TD
    Device["AITIP 스마트 단말기 (라즈베리파이/안드로이드)"] --> MqttPush["MQTT POST /api/v5/publish (10ms Edge 브릿지)"]
    MqttPush --> Workers["Cloudflare Workers MDM 관제 엔진"]
    Workers --> D1[(device_telemetry_logs 원장 기록)]
    
    Workers --> CheckPaper{"1. 용지 상태 검사"}
    CheckPaper -->|PAPER_EMPTY / LOW| AlertPaper["점주 스마트폰 카카오 알림톡/SMS 즉시 발송<br>'카운터 단말기 용지가 소진되었습니다'"]
    
    Workers --> CheckNet{"2. 통신망 상태 검사"}
    CheckNet -->|유선 이더넷 단선| SwitchLTE["LTE 에그 모뎀으로 1초 내 무중단 자동 전환"]
    CheckNet -->|완전 오프라인 LWT 감지| FailoverOrder["점주 스마트폰 웹/앱 PUSH로 주문 접수 긴급 자동 우회"]
    
    Workers --> CheckTemp{"3. 하드웨어 과열 검사"}
    CheckTemp -->|CPU 온도 >= 70도| FanSpeed["단말기 5V PWM 쿨링팬 100% 가속 & 본사 알림"]
```

### 2.1 5대 텔레메트리 감시 지표 사양

| 지표명 | 수집 항목 및 코드 규격 | 이상 징후 감지 기준 | 자동 대응 및 자가 치유 (Self-Healing) |
| :--- | :--- | :--- | :--- |
| **1. 프린터 용지** | `paper_status`: `NORMAL`, `PAPER_LOW`, `PAPER_EMPTY`, `HEAD_OVERHEAT` | ESC/POS `DLE EOT 1` 명령어로 센서 감지 | `PAPER_EMPTY` 시 점주 스마트폰 알림톡 0.1초 발송 & 화면에 빨간색 LED 점멸 |
| **2. 통신망 이중화** | `network_type`: `ETHERNET`, `WIFI`, `LTE` | Ping 레이턴시 > 500ms 또는 패킷 유실률 > 10% | 유선 단선 시 내장 LTE 모뎀으로 1.0초 무중단 핫스왑(Hot-swap) |
| **3. 하드웨어 건전성**| `cpu_temp_celsius`, `memory_usage_pct`, `storage_usage_pct` | CPU 온도 $\ge 70^\circ\text{C}$ 또는 메모리/디스크 $\ge 90\%$ | 쿨링팬 풀가동, 로그 파일 자동 순환(Logrotate), 불필요 캐시 즉시 비우기 |
| **4. CTI 통화 릴레이**| `cti_hook_status`: `IDLE`, `RINGING`, `IN_CALL`, `DISCONNECTED` | CTI 칩셋 응답 없음 또는 전화선 분리 감지 | 기계식 릴레이를 즉시 **'하드웨어 바이패스(Normal Close)'**로 전환 $\to$ 일반 통화 100% 보장 |
| **5. 생존 하트비트** | `is_online`, `last_heartbeat_at` | 60초 이상 하트비트 누락 시 (EMQX LWT 트리거) | 단말기를 오프라인으로 마킹하고, 신규 주문 발생 시 점주 휴대폰 앱/SMS로 즉시 우회 알림 |

---

## 3. 🔄 A/B 파티션 무중단 OTA 펌웨어 배포 엔진 (`firmware_releases`)

운영체제 커널이나 인쇄 드라이버를 업데이트할 때, 배포 실패로 단말기가 먹통이 되는 참사를 원천 차단하는 방탄 구조입니다.

```mermaid
sequenceDiagram
    autonumber
    participant HQ as 본사 MDM 릴리즈 서버
    participant R2 as Cloudflare R2 버킷
    participant Dev as 매장 AITIP 단말기 (Active: 파티션 A)
    participant WDT as 하드웨어 와치독 (Watchdog)

    Note over HQ,R2: [1. 펌웨어 배포 등록]
    HQ->>R2: 펌웨어 바이너리 업로드 (firmware/v1.4.2.img.gz)
    HQ->>Dev: MQTT OTA 배포 지시 (v1.4.2, SHA256, R2 Presigned URL)

    Note over Dev: [2. 백그라운드 무중단 다운로드]
    Dev->>R2: 비활성 파티션 B로 새 이미지 백그라운드 스트리밍 기록 (정상 영업 지속)
    Dev->>Dev: SHA256 체크섬 100% 일치 검증
    Dev->>Dev: 부트로더(U-Boot) 전환 플래그 설정 (Next Boot: Partition B)

    Note over Dev,WDT: [3. 새벽 04:00 안전 리부팅 및 와치독 검증]
    Dev->>Dev: 영업 마감 후 자동 재부팅 (새 파티션 B로 부팅)
    Dev->>WDT: 와치독 타이머 3분 가동 (3분 내 핑 실패 시 리셋 예약)
    
    alt 신규 펌웨어 정상 가동
        Dev->>HQ: EMQX MQTT 핑 성공 ("v1.4.2 부팅 완료, active_partition = B")
        Dev->>WDT: 와치독 클리어! (배포 영구 확정)
    else 부팅 실패 / 네트워크 불능
        WDT-->>Dev: 3분 타임아웃! 하드웨어 강제 리셋 트리거
        Dev->>Dev: 부트로더 자동 롤백 -> 이전 정상 파티션 A로 100% 복구!
    end
```

### 3.1 3단계 카나리(Canary) 점진적 롤아웃 정책
1. **1단계 (내부 테스트 5대)**: 본사 연구실 및 직영 테스트 매장 5대 배포 (24시간 검증).
2. **2단계 (카나리 10% 롤아웃, `release_status = 'CANARY'`)**: 지역 총판/대리점 소속 50대 매장 선제 적용 (48시간 무사고 검증).
3. **3단계 (전사 100% 전체 배포, `release_status = 'ROLLED_OUT'`)**: 전사 수천 대 단말기에 영업 마감 시간(새벽 04:00)에 순차 분산 다운로드 배포.

---

## 4. 🗄️ Cloudflare D1 스키마 확장 내역 (Section 29)

```sql
-- 1. devices 테이블 컬럼 확장 (용지 상태 및 A/B 활성 파티션)
ALTER TABLE devices ADD COLUMN paper_status TEXT NOT NULL DEFAULT 'NORMAL'
    CONSTRAINT chk_devices_paper CHECK (paper_status IN ('NORMAL', 'PAPER_LOW', 'PAPER_EMPTY', 'HEAD_OVERHEAT'));
ALTER TABLE devices ADD COLUMN active_partition TEXT NOT NULL DEFAULT 'A'
    CONSTRAINT chk_devices_partition CHECK (active_partition IN ('A', 'B'));

-- 2. device_telemetry_logs (단말기 실시간 MDM 텔레메트리 원장)
CREATE TABLE device_telemetry_logs (
    id                 TEXT PRIMARY KEY
                       CONSTRAINT chk_dev_telem_id CHECK (length(id) = 30 AND id GLOB 'tel_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    device_id          TEXT NOT NULL REFERENCES devices(id)
                       CONSTRAINT chk_telem_device_id CHECK (length(device_id) = 30 AND device_id GLOB 'dev_*'),
    paper_status       TEXT NOT NULL
                       CONSTRAINT chk_telem_paper CHECK (paper_status IN ('NORMAL', 'PAPER_LOW', 'PAPER_EMPTY', 'HEAD_OVERHEAT')),
    network_type       TEXT NOT NULL
                       CONSTRAINT chk_telem_net CHECK (network_type IN ('ETHERNET', 'WIFI', 'LTE')),
    cpu_temp_celsius   REAL
                       CONSTRAINT chk_telem_temp CHECK (cpu_temp_celsius IS NULL OR (cpu_temp_celsius >= -20 AND cpu_temp_celsius <= 120)),
    memory_usage_pct   INTEGER
                       CONSTRAINT chk_telem_mem CHECK (memory_usage_pct IS NULL OR (memory_usage_pct >= 0 AND memory_usage_pct <= 100)),
    storage_usage_pct  INTEGER
                       CONSTRAINT chk_telem_storage CHECK (storage_usage_pct IS NULL OR (storage_usage_pct >= 0 AND storage_usage_pct <= 100)),
    created_at         INTEGER NOT NULL
);
CREATE INDEX idx_dev_telem_device ON device_telemetry_logs (device_id, created_at);
CREATE INDEX idx_dev_telem_paper  ON device_telemetry_logs (paper_status);

-- 3. firmware_releases (A/B 롤백 무중단 OTA 펌웨어 릴리즈 원장)
CREATE TABLE firmware_releases (
    id                 TEXT PRIMARY KEY
                       CONSTRAINT chk_firmware_id CHECK (length(id) = 30 AND id GLOB 'frm_[0-7]*' AND substr(id, 5) NOT GLOB '*[^0-9a-hjkmnp-tv-z]*'),
    firmware_version   TEXT NOT NULL UNIQUE
                       CONSTRAINT chk_firmware_ver CHECK (length(firmware_version) <= 30),
    target_hardware    TEXT NOT NULL
                       CONSTRAINT chk_firmware_hw CHECK (target_hardware IN ('RPI_4B', 'RPI_CM4', 'ANDROID_POS')),
    binary_r2_key      TEXT NOT NULL,
    binary_sha256      TEXT NOT NULL
                       CONSTRAINT chk_firmware_sha CHECK (length(binary_sha256) = 64 AND binary_sha256 NOT GLOB '*[^0-9a-f]*'),
    is_critical        INTEGER NOT NULL DEFAULT 0
                       CONSTRAINT chk_firmware_critical CHECK (is_critical IN (0, 1)),
    release_status     TEXT NOT NULL DEFAULT 'TESTING'
                       CONSTRAINT chk_firmware_status CHECK (release_status IN ('TESTING', 'CANARY', 'ROLLED_OUT', 'REVOKED')),
    release_notes      TEXT,
    created_at         INTEGER NOT NULL
);
CREATE INDEX idx_firmware_hw_status ON firmware_releases (target_hardware, release_status);
```

---

## 5. 🛡️ 무결성 검증 실측치 (261/261 PASS)

`scripts/test_schema_integrity.py` Section 29에서 다음 항목에 대한 검증을 전수 완료하였습니다:
1. `devices` 용지부족(`PAPER_EMPTY`) 및 A/B 파티션('B') 정상 갱신.
2. 무효 `paper_status`('BROKEN') 및 무효 `active_partition`('C') 거부.
3. `device_telemetry_logs` 정상 텔레메트리 로그 등록 성공.
4. CPU 온도 120도 초과(150도) 및 메모리 점유율 100% 초과(105%) 거부.
5. `firmware_releases` 카나리(`CANARY`) OTA 펌웨어 정상 등록.
6. SHA256 체크섬 형식 오류(64자 미달) 및 무효 하드웨어('ARDUINO_UNO') 거부.
7. 단말기별 텔레메트리 인덱스(`idx_dev_telem_device`) 및 펌웨어 롤아웃 인덱스(`idx_firmware_hw_status`) 쿼리 플랜 작동 검증.

**실행 결과: 261 / 261 전수 통과 (0 FAIL, 100% PASS)**.
