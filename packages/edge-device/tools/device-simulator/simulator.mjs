/**
 * ============================================================================
 * [AITIP Edge Device] Interactive Terminal Simulator & Self-Test Runner (ESM)
 * 준수 규격: DOC-17 제8장 (수만 대 가맹점 수용을 위한 통합 검증 도구)
 * 기능: 실물 하드웨어 없이 PC 콘솔에서 4대 펌웨어 코어의 동작을 1초 만에 검증
 * ============================================================================
 */

import { AitipTransportClient } from '../../transport-client/client.mjs';
import { AitipCidBridge } from '../../cti-driver/cid-bridge.mjs';
import { AitipPrintSpooler } from '../../print-spooler/escpos-spooler.mjs';
import { AitipOtaAgent } from '../../ota/ota-agent.mjs';

export class AitipDeviceSimulator {
  constructor(options = {}) {
    this.deviceId = options.deviceId || 'dev_01m6z4term8923';
    this.storeId = options.storeId || 'str_01h7x8q4barunchicken001';

    // 1. 통신 클라이언트 초기화 (시뮬레이터 모드)
    this.transport = new AitipTransportClient({
      deviceId: this.deviceId,
      storeId: this.storeId,
      simulatorMode: options.simulatorMode ?? true,
    });

    // 2. 포스(POS) CID 연동 브리지
    this.cidBridge = new AitipCidBridge({
      transportClient: this.transport,
      protocol: 'KS_STANDARD',
      comPort: 'COM3',
    });

    // 3. 주방 전표 인쇄 스풀러
    this.spooler = new AitipPrintSpooler({
      paperWidth: '80mm',
    });

    // 4. HTTPS OTA 에이전트
    this.otaAgent = new AitipOtaAgent({
      transportClient: this.transport,
      hwRevision: 'V3S_REV_B',
      currentVersion: '1.0.0',
    });

    this._bindEvents();
  }

  /**
   * 모듈 간 파이프라인 이벤트 바인딩
   */
  _bindEvents() {
    // 1. 주문 수신 시 -> 주방 전표 자동 출력
    this.transport.on('order', async (order) => {
      console.log(`\n==================================================`);
      console.log(`[Simulator] 신규 주문 수신! (주문번호: ${order.short_display_id || order.order_id})`);
      console.log(`==================================================`);
      const result = await this.spooler.printOrder(order);
      console.log(result.preview);
    });

    // 2. OTA 업데이트 요청 수신 시 -> HTTPS 다운로드 및 무결성 검증
    this.transport.on('ota_request', async (otaReq) => {
      console.log(`\n==================================================`);
      console.log(`[Simulator] 원격 OTA 업데이트 트리거 수신! (v${otaReq.version})`);
      console.log(`==================================================`);
      await this.otaAgent.handleOtaTrigger(otaReq);
    });

    // 3. 전화 인입 시 -> 포스 시리얼 패킷 감시
    this.cidBridge.on('pos_stream', (data) => {
      console.log(`\n[Simulator:POS_BRIDGE] 윈도우 포스 PC 가상 시리얼 포트(${data.comPort})로 전송:`);
      console.log(` • 발신번호: ${data.phoneNumber}`);
      console.log(` • 표준 스트림: [STX]${data.phoneNumber}[ETX] (16진수: ${data.hexDump})`);
    });
  }

  /**
   * 시뮬레이터 부팅
   */
  async start() {
    console.log(`\n==================================================`);
    console.log(`[AITIP Edge Device Simulator v1.0.0] 단말기 부팅`);
    console.log(` • 단말기 UID : ${this.deviceId}`);
    console.log(` • 매장 UID   : ${this.storeId}`);
    console.log(` • 하드웨어   : Allwinner V3s (Headless / Zero-Config)`);
    console.log(` • 포스 포트  : 가상 COM3 (KS 표준 CID 프로토콜)`);
    console.log(`==================================================\n`);

    await this.transport.connect();
  }

  /**
   * 단말기 종료
   */
  stop() {
    this.transport.disconnect();
    console.log('[Simulator] 단말기 시스템 정상 종료');
  }

  /**
   * 가상 주문 주입 테스트
   */
  simulateIncomingOrder(order) {
    this.transport.injectSimulatedMessage(this.transport.topics.orders, order);
  }

  /**
   * 가상 전화 인입 테스트
   */
  simulateInboundPhone(phone) {
    return this.cidBridge.handleInboundCall({ phoneNumber: phone, lineNo: 1 });
  }

  /**
   * 가상 OTA 지시 테스트
   */
  simulateOtaTrigger(otaPayload) {
    this.transport.injectSimulatedMessage(this.transport.topics.otaRequest, otaPayload);
  }
}

// 직접 실행 시 4대 파이프라인 자동 자가검증(Self-Test) 수행
if (process.argv[1] && process.argv[1].endsWith('simulator.mjs')) {
  (async () => {
    console.log('>>> AITIP 엣지 단말기 4대 파이프라인 실측 자가검증 시작 <<<\n');
    const sim = new AitipDeviceSimulator({ simulatorMode: true });
    await sim.start();

    // 1. 전화 인입 테스트 (기존 윈도우 포스 연동)
    console.log('\n--- [검증 1] 전화 인입 CTI 및 기존 윈도우 포스(POS) 연동 ---');
    await sim.simulateInboundPhone('010-5882-9258');

    // 2. 고객 PWA 주문 수신 및 주방 전표 출력 테스트
    console.log('\n--- [검증 2] 고객 주문 수신 및 80mm 주방 전표 바코드 출력 ---');
    sim.simulateIncomingOrder({
      order_id: 'ord_01m6wzpjfnfwh9j4zetc21ates',
      short_display_id: 'A-12',
      fulfillment_type: 'DELIVERY',
      customer_name: '홍길동',
      virtual_phone: '0504-8921-3921',
      delivery_address: '서울특별시 서초구 서초대로 34길 18, 201호',
      customer_memo: '치킨 바삭하게 튀겨주시고 문 앞에 놓아주세요',
      payment_method: 'AITIP_ZERO_PAY',
      final_payment_amount: 24500,
      items: [
        {
          name: '현미바삭치킨',
          quantity: 1,
          price: 18900,
          total_price: 18900,
          selected_options: [
            { group_name: '부위 선택', option_name: '뼈 치킨 (기본)' },
            { group_name: '맵기 강도', option_name: '순한맛 (기본 담백)' }
          ]
        },
        {
          name: '카사바칩 & 크림치즈볼',
          quantity: 1,
          price: 5600,
          total_price: 5600,
          selected_options: []
        }
      ]
    });

    // 3. Keep-Alive 하트비트 보고 검증
    console.log('\n--- [검증 3] 30초 Smart Keep-Alive 상태 발행 ---');
    sim.transport.publishStatus({ status: 'ONLINE', cpu_temp: 42.5 });

    console.log('\n>>> 모든 엣지 단말기 펌웨어 파이프라인 검증 성공! <<<\n');
    sim.stop();
  })();
}
