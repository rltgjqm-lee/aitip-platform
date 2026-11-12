/**
 * ============================================================================
 * [AITIP Edge Device] CTI Caller ID (CID) Bridge Engine (ESM)
 * 준수 규격: DOC-17 제5.3항 (유니버설 기존 포스 연동 및 클라우드 동시 브로드캐스트)
 * 특성: 한국 포스 표준 CID ASCII 프로토콜, USB 가상 시리얼(COM 포트) 에뮬레이션,
 *       로컬 루프백 소켓 및 클라우드 MQTTS 트리플 브로드캐스트
 * ============================================================================
 */

import { EventEmitter } from 'node:events';

export class AitipCidBridge extends EventEmitter {
  /**
   * @param {Object} options
   * @param {Object} [options.transportClient] - AitipTransportClient 인스턴스
   * @param {string} [options.protocol='KS_STANDARD'] - 'KS_STANDARD' | 'BELL_FORMAT' | 'RAW_ASCII'
   * @param {string} [options.comPort='COM3'] - 윈도우 포스 연결 가상 시리얼 포트
   */
  constructor(options = {}) {
    super();

    this.transportClient = options.transportClient || null;
    this.protocol = options.protocol || 'KS_STANDARD';
    this.comPort = options.comPort || 'COM3';

    // 최근 인입된 발신번호 캐시 (중복 링 필터링: 3초 윈도우)
    this.recentCalls = new Map();
  }

  /**
   * 한국 포스(POS) 업계 표준 CID 스트림 인코딩
   * 오케이포스(OKPOS), 이지포스(EasyPOS), 포스뱅크 등 기존 윈도우 포스 소프트웨어가
   * 일반 유선 CID 단말기 신호로 인식하도록 ASCII 바이트 스트림 생성
   * 
   * @param {string} phoneNumber - 발신자 전화번호 (예: 010-1234-5678 또는 02-588-9258)
   * @returns {Buffer} 시리얼 포트 전송용 바이너리 버퍼
   */
  encodePosCidPacket(phoneNumber) {
    const rawNumber = (phoneNumber || '').replace(/[^0-9]/g, '');

    if (this.protocol === 'KS_STANDARD') {
      // 한국 표준 유선 CID 단말기 포맷: [STX]전화번호[ETX] (0x02 + ASCII + 0x03)
      return Buffer.from([0x02, ...Buffer.from(rawNumber, 'ascii'), 0x03]);
    } else if (this.protocol === 'BELL_FORMAT') {
      // 통신사 모뎀 벨소리 규격: \r\nRING\r\nNMBR = 01012345678\r\n
      const str = `\r\nRING\r\nNMBR = ${rawNumber}\r\n`;
      return Buffer.from(str, 'ascii');
    } else {
      // 기본 개행 포맷
      return Buffer.from(`${rawNumber}\r\n`, 'ascii');
    }
  }

  /**
   * 매장 전화 인입 링 이벤트 처리 (전화 감지기 또는 SIP B2BUA 하드웨어 릴레이에서 호출)
   * 
   * @param {Object} callInfo
   * @param {string} callInfo.phoneNumber - 발신자 전화번호
   * @param {number} [callInfo.lineNo=1] - 전화 국선 번호
   * @param {string} [callInfo.callTime] - 통화 인입 일시 (ISO)
   * @returns {Object} 처리 결과 요약
   */
  async handleInboundCall(callInfo) {
    const rawPhone = (callInfo.phoneNumber || '').trim();
    if (!rawPhone) {
      console.warn('[CidBridge] 유효하지 않은 전화번호 인입 무시');
      return { success: false, reason: 'EMPTY_PHONE' };
    }

    // 3초 내 동일 번호 중복 링 디바운싱(Debounce)
    const now = Date.now();
    const lastSeen = this.recentCalls.get(rawPhone);
    if (lastSeen && now - lastSeen < 3000) {
      return { success: true, debounced: true };
    }
    this.recentCalls.set(rawPhone, now);

    const callTime = callInfo.callTime || new Date().toISOString();
    const cidEvent = {
      caller_phone: rawPhone,
      line_no: callInfo.lineNo || 1,
      call_time: callTime,
      timestamp: now,
    };

    console.log(`[CidBridge] 전화 인입 감지 -> 발신번호: ${rawPhone} (국선: ${cidEvent.line_no}번)`);

    // 1. 기존 윈도우 포스(POS) PC 가상 시리얼 포트 스트림 생성
    const posPacket = this.encodePosCidPacket(rawPhone);

    // 2. 로컬 이벤트 방출 (포스 시리얼 드라이버 또는 로컬 소켓 리스너로 전송)
    this.emit('pos_stream', {
      comPort: this.comPort,
      rawPacket: posPacket,
      hexDump: posPacket.toString('hex'),
      phoneNumber: rawPhone,
    });

    // 3. 클라우드 브로커 MQTTS 브로드캐스트 (주방 태블릿 PWA 및 사장님 모바일로 동시 푸시)
    let mqttPublished = false;
    if (this.transportClient) {
      try {
        await this.transportClient.publishTelephony(cidEvent);
        mqttPublished = true;
      } catch (err) {
        console.error('[CidBridge] 클라우드 MQTTS 전화 이벤트 발행 실패:', err);
      }
    }

    // 4. 단말기 내부 이벤트 통보
    this.emit('inbound_call', {
      ...cidEvent,
      posPacketHex: posPacket.toString('hex'),
      mqttPublished,
    });

    return {
      success: true,
      phoneNumber: rawPhone,
      posPacketSent: true,
      mqttPublished,
    };
  }

  /**
   * 윈도우 가상 시리얼 포트(COM3~COM9) 목업 출력 헬퍼
   */
  simulatePosReceipt(phoneNumber) {
    const packet = this.encodePosCidPacket(phoneNumber);
    return {
      comPort: this.comPort,
      protocol: this.protocol,
      byteLength: packet.length,
      hexString: packet.toString('hex'),
      rawAscii: packet.toString('ascii').replace(/\x02/g, '<STX>').replace(/\x03/g, '<ETX>'),
    };
  }
}
