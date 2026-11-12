/**
 * ============================================================================
 * [AITIP Edge Device] ESC/POS Kitchen & Counter Print Spooler (ESM)
 * 준수 규격: DOC-02, DOC-17, TastyPrinter 오픈소스 벤치마크 표준
 * 특성: CUPS 의존성 0% 순수 바이트 빌더, 58mm/80mm 감열 영수증, 1D 바코드,
 *       주방 전표 강조 레이아웃 및 자동 절단(Full/Partial Cut)
 * ============================================================================
 */

import { EventEmitter } from 'node:events';

export class AitipPrintSpooler extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {string} [options.paperWidth='80mm'] - '80mm' (42자) 또는 '58mm' (32자)
   * @param {string} [options.printerPort='/dev/usb/lp0'] - USB 감열 프린터 장치 경로
   */
  constructor(options = {}) {
    super();

    this.paperWidth = options.paperWidth || '80mm';
    this.maxChars = this.paperWidth === '58mm' ? 32 : 42;
    this.printerPort = options.printerPort || '/dev/usb/lp0';
  }

  /**
   * ESC/POS 명령어 바이트 빌더
   */
  static Commands = {
    INIT: Buffer.from([0x1b, 0x40]), // ESC @
    ALIGN_LEFT: Buffer.from([0x1b, 0x61, 0x00]), // ESC a 0
    ALIGN_CENTER: Buffer.from([0x1b, 0x61, 0x01]), // ESC a 1
    ALIGN_RIGHT: Buffer.from([0x1b, 0x61, 0x02]), // ESC a 2
    BOLD_ON: Buffer.from([0x1b, 0x45, 0x01]), // ESC E 1
    BOLD_OFF: Buffer.from([0x1b, 0x45, 0x00]), // ESC E 0
    DOUBLE_SIZE: Buffer.from([0x1d, 0x21, 0x11]), // GS ! 0x11 (2배 확대)
    QUAD_SIZE: Buffer.from([0x1d, 0x21, 0x22]), // GS ! 0x22 (3배 확대)
    NORMAL_SIZE: Buffer.from([0x1d, 0x21, 0x00]), // GS ! 0x00 (기본 크기)
    LINE_FEED: Buffer.from([0x0a]), // LF
    FEED_3_LINES: Buffer.from([0x1b, 0x64, 0x03]), // ESC d 3
    PAPER_CUT: Buffer.from([0x1d, 0x56, 0x00]), // GS V 0 (전체 자르기)
    DRAWER_KICK: Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]), // 돈통 열기
  };

  /**
   * 1D Code128 바코드 ESC/POS 바이트 생성
   * @param {string} code - 바코드 문자열 (주문번호 A-12 또는 TypeID)
   */
  buildBarcodeBytes(code) {
    const raw = Buffer.from(code, 'ascii');
    return Buffer.concat([
      AitipPrintSpooler.Commands.ALIGN_CENTER,
      Buffer.from([0x1d, 0x68, 0x48]), // GS h 72 (바코드 높이 72도트)
      Buffer.from([0x1d, 0x77, 0x02]), // GS w 2 (모듈 폭 2도트)
      Buffer.from([0x1d, 0x48, 0x02]), // GS H 2 (HRI 텍스트 아래 표출)
      Buffer.from([0x1d, 0x6b, 0x49, raw.length]), // GS k 73 (Code128) + 길이
      raw,
      AitipPrintSpooler.Commands.LINE_FEED,
    ]);
  }

  /**
   * 주문 객체로부터 주방 전표(Kitchen Ticket) ESC/POS 바이트 스트림 조립
   * @param {Object} order - AITIP 표준 주문 객체
   * @returns {Buffer} 열전사 프린터 직결 전송용 바이너리 버퍼
   */
  buildKitchenTicketBuffer(order) {
    const parts = [];
    const push = (buf) => parts.push(buf);
    const pushText = (text) => parts.push(Buffer.from(text + '\n', 'utf-8'));

    const C = AitipPrintSpooler.Commands;
    const divider = '='.repeat(this.maxChars);
    const dashed = '-'.repeat(this.maxChars);

    // 1. 프린터 초기화
    push(C.INIT);

    // 2. 헤더: 주방 주문 전표 (중앙 정렬, 2배 확대)
    push(C.ALIGN_CENTER);
    push(C.BOLD_ON);
    push(C.DOUBLE_SIZE);
    pushText(`[주방 전표: ${order.short_display_id || '주문'}]`);
    push(C.NORMAL_SIZE);

    // 3. 주문 유형 강조 (배달 / 포장 / 매장식사)
    const typeNames = {
      DELIVERY: '[ 배 달 주 문 ]',
      TAKEOUT: '[ 포 장 (픽 업) ]',
      DINE_IN: `[ 매 장 식 사 : 테이블 ${order.table_no || '-'}번 ]`,
    };
    pushText(typeNames[order.fulfillment_type] || order.fulfillment_type);
    push(C.BOLD_OFF);
    push(C.ALIGN_LEFT);

    pushText(divider);

    // 4. 주문 메타 정보
    const dateStr = order.created_at ? new Date(order.created_at).toLocaleString('ko-KR') : new Date().toLocaleString('ko-KR');
    pushText(`주문일시: ${dateStr}`);
    pushText(`주문번호: ${order.short_display_id || '-'} (${order.order_id || '-'})`);
    if (order.virtual_phone) {
      pushText(`고객연락: ${order.virtual_phone} (0504 안심번호)`);
    }
    if (order.fulfillment_type === 'DELIVERY' && order.delivery_address) {
      push(C.BOLD_ON);
      pushText(`배달주소: ${order.delivery_address}`);
      push(C.BOLD_OFF);
    }
    if (order.customer_memo) {
      push(C.BOLD_ON);
      pushText(`요청사항: ${order.customer_memo}`);
      push(C.BOLD_OFF);
    }

    pushText(dashed);

    // 5. 메뉴 품목 목록 (품목명 2배 확대)
    push(C.BOLD_ON);
    pushText('메뉴명                       수량      금액');
    push(C.BOLD_OFF);
    pushText(dashed);

    (order.items || []).forEach((item) => {
      push(C.BOLD_ON);
      push(C.DOUBLE_SIZE);
      pushText(`${item.name}  x ${item.quantity || 1}`);
      push(C.NORMAL_SIZE);
      push(C.BOLD_OFF);

      // 옵션 내역 들여쓰기
      if (item.selected_options && item.selected_options.length > 0) {
        item.selected_options.forEach((opt) => {
          pushText(`  + [${opt.group_name}] ${opt.option_name}`);
        });
      }
      push(C.LINE_FEED);
    });

    pushText(divider);

    // 6. 합계 금액
    push(C.ALIGN_RIGHT);
    push(C.BOLD_ON);
    push(C.DOUBLE_SIZE);
    pushText(`총 결제액: ${(order.final_payment_amount || 0).toLocaleString()}원`);
    push(C.NORMAL_SIZE);
    push(C.BOLD_OFF);
    push(C.ALIGN_LEFT);

    // 7. 픽업/배달 확인용 1D 바코드 인쇄
    const barcodeCode = order.short_display_id || order.order_id || 'A-01';
    push(this.buildBarcodeBytes(barcodeCode));

    // 8. 용지 배출 및 자동 커팅
    push(C.FEED_3_LINES);
    push(C.PAPER_CUT);

    return Buffer.concat(parts);
  }

  /**
   * 콘솔 화면에 영수증/전표 박스 텍스트 시뮬레이션 렌더링
   * @param {Object} order
   * @returns {string} 아스키 박스 영수증
   */
  renderConsoleReceiptPreview(order) {
    const w = this.maxChars;
    const pad = (s, len) => s + ' '.repeat(Math.max(0, len - s.length));
    const border = '┌' + '─'.repeat(w) + '┐';
    const bottom = '└' + '─'.repeat(w) + '┘';
    const mid = '├' + '─'.repeat(w) + '┤';
    const row = (str) => '│ ' + pad(str, w - 2) + ' │';

    const lines = [
      border,
      row(`  [AITIP 가맹점 주방 전표]  `),
      row(`주문번호: ${order.short_display_id || 'A-XX'} (${order.fulfillment_type || 'DELIVERY'})`),
      mid,
      row(`일시: ${new Date().toLocaleTimeString('ko-KR')}`),
      row(`고객: ${order.customer_name || '고객'} (${order.virtual_phone || order.customer_phone || '-'})`),
    ];

    if (order.delivery_address) {
      lines.push(row(`주소: ${order.delivery_address}`));
    }
    if (order.customer_memo) {
      lines.push(row(`요청: ${order.customer_memo}`));
    }

    lines.push(mid);
    lines.push(row('메뉴 품목:'));
    (order.items || []).forEach((it) => {
      lines.push(row(` • ${it.name} x ${it.quantity}개  (${((it.total_price || it.price) * (it.quantity || 1)).toLocaleString()}원)`));
      if (it.selected_options) {
        it.selected_options.forEach((o) => {
          lines.push(row(`    - ${o.group_name}: ${o.option_name}`));
        });
      }
    });

    lines.push(mid);
    lines.push(row(`총 결제금액: ${(order.final_payment_amount || 0).toLocaleString()}원 (${order.payment_method || 'CARD'})`));
    lines.push(row(`바코드: ||||| | |||| ||| [${order.short_display_id || 'A-01'}]`));
    lines.push(bottom);

    return lines.join('\n');
  }

  /**
   * 주문 전표 출력 처리 (프린터 직결 또는 시뮬레이션)
   * @param {Object} order
   */
  async printOrder(order) {
    const rawBuffer = this.buildKitchenTicketBuffer(order);
    const consolePreview = this.renderConsoleReceiptPreview(order);

    console.log(`[PrintSpooler] 주방 전표 출력 생성 완료 (바이트 수: ${rawBuffer.length} bytes)`);

    this.emit('print_job', {
      orderId: order.order_id,
      shortId: order.short_display_id,
      byteLength: rawBuffer.length,
      rawBuffer,
      preview: consolePreview,
    });

    return {
      success: true,
      bytes: rawBuffer.length,
      preview: consolePreview,
    };
  }
}
