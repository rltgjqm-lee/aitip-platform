/**
 * ============================================================================
 * [AITIP Edge Device] Transport Client Core (ESM)
 * 준수 규격: DOC-17 (공유기 무설정 아웃바운드 MQTT / WSS 이중화 통신)
 * 특성: 인바운드 포트 0%, 30초 Smart Keep-Alive, 기기별 ACL 토픽 격리
 * ============================================================================
 */

import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

export class AitipTransportClient extends EventEmitter {
  /**
   * @param {Object} options
   * @param {string} options.deviceId - 단말기 고유 UID (dev_...)
   * @param {string} options.storeId - 가맹점 고유 UID (str_...)
   * @param {string} [options.secretKey] - HMAC-SHA256 사전 공유 키 (PSK)
   * @param {string} [options.brokerUrl] - 브로커 URL (mqtts://broker.aitip.kr:8883 또는 wss://broker.aitip.kr:8084/mqtt)
   * @param {boolean} [options.simulatorMode=false] - 실물 브로커 부재 시 로컬 가상 시뮬레이터 모드
   */
  constructor(options = {}) {
    super();

    if (!options.deviceId || !options.storeId) {
      throw new Error('[TransportClient] deviceId와 storeId는 필수 파라미터입니다.');
    }

    this.deviceId = options.deviceId;
    this.storeId = options.storeId;
    this.secretKey = options.secretKey || 'aitip_device_secret_default_key';
    this.brokerUrl = options.brokerUrl || 'wss://broker.aitip.kr:8084/mqtt';
    this.simulatorMode = options.simulatorMode ?? false;

    // DOC-17 제4장: 표준 토픽 격리 규격
    this.topics = {
      orders: `aitip/stores/${this.storeId}/orders`,
      config: `aitip/devices/${this.deviceId}/config`,
      otaRequest: `aitip/update/request/${this.deviceId}`,
      telephony: `aitip/devices/${this.deviceId}/telephony`,
      status: `aitip/devices/${this.deviceId}/status`,
    };

    this.isConnected = false;
    this.keepAliveInterval = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 30000; // 최대 30초
    this.client = null;
  }

  /**
   * 기기 인증 토큰 생성 (HMAC-SHA256)
   */
  generateAuthToken() {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac('sha256', this.secretKey)
      .update(`${this.deviceId}:${timestamp}`)
      .digest('hex');
    return `${timestamp}:${signature}`;
  }

  /**
   * 아웃바운드 연결 수립 (공유기 설정 제로)
   */
  async connect() {
    if (this.simulatorMode) {
      console.log(`[TransportClient] 시뮬레이터 모드로 가상 연결 수립 (단말기: ${this.deviceId})`);
      this.isConnected = true;
      this._startKeepAlive();
      this.emit('connect', { mode: 'SIMULATOR', deviceId: this.deviceId });
      return;
    }

    try {
      // 1. MQTT.js 라이브러리 동적 로드 시도
      let mqtt = null;
      try {
        mqtt = await import('mqtt');
      } catch (e) {
        mqtt = null;
      }

      if (mqtt && (mqtt.connect || mqtt.default?.connect)) {
        const connectFn = mqtt.connect || mqtt.default.connect;
        const authToken = this.generateAuthToken();

        console.log(`[TransportClient] 아웃바운드 브로커 연결 시도: ${this.brokerUrl}`);

        this.client = connectFn(this.brokerUrl, {
          clientId: this.deviceId,
          username: this.deviceId,
          password: authToken,
          clean: false, // QoS 1 세션 유지
          keepalive: 30, // DOC-17 제2장: 30초 Smart Keep-Alive (NAT 타임아웃 방지)
          reconnectPeriod: 2000,
          connectTimeout: 5000,
          protocolVersion: 5,
        });

        this.client.on('connect', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          console.log(`[TransportClient] 브로커 연결 성공 (MQTTS/WSS) -> 토픽 구독 시작`);

          // 핵심 토픽 3종 일괄 구독 (QoS 1)
          const subscribeTopics = [this.topics.orders, this.topics.config, this.topics.otaRequest];
          this.client.subscribe(subscribeTopics, { qos: 1 }, (err) => {
            if (err) {
              console.error('[TransportClient] 토픽 구독 실패:', err);
            } else {
              console.log(`[TransportClient] 구독 완료: ${subscribeTopics.join(', ')}`);
            }
          });

          this.emit('connect', { deviceId: this.deviceId });
        });

        this.client.on('message', (topic, payloadBuffer) => {
          this._handleIncomingMessage(topic, payloadBuffer.toString('utf-8'));
        });

        this.client.on('close', () => {
          this.isConnected = false;
          this.emit('disconnect', { reason: 'CONNECTION_CLOSED' });
        });

        this.client.on('error', (err) => {
          console.error('[TransportClient] 브로커 에러:', err.message);
          this.emit('error', err);
        });

      } else {
        // mqtt 라이브러리가 없는 환경: 경량 시뮬레이터 자동 폴백
        console.warn('[TransportClient] mqtt 모듈 미설치 -> 시뮬레이터 내부 버스 모드로 동작합니다.');
        this.simulatorMode = true;
        this.isConnected = true;
        this._startKeepAlive();
        this.emit('connect', { mode: 'STANDALONE_FALLBACK', deviceId: this.deviceId });
      }
    } catch (err) {
      console.error('[TransportClient] 연결 초기화 실패:', err);
      this._scheduleReconnect();
    }
  }

  /**
   * 인입 메시지 라우터
   */
  _handleIncomingMessage(topic, payloadStr) {
    try {
      const data = JSON.parse(payloadStr);

      if (topic === this.topics.orders) {
        console.log(`[TransportClient] 신규 주문 인입 (토픽: ${topic})`);
        this.emit('order', data);
      } else if (topic === this.topics.otaRequest) {
        console.log(`[TransportClient] OTA 업데이트 트리거 인입: v${data.version}`);
        this.emit('ota_request', data);
      } else if (topic === this.topics.config) {
        console.log(`[TransportClient] 원격 설정 변경 수신:`, data);
        this.emit('config', data);
      } else {
        this.emit('message', { topic, data });
      }
    } catch (err) {
      console.error('[TransportClient] 메시지 파싱 에러:', err, payloadStr);
    }
  }

  /**
   * 30초 Smart Keep-Alive 헬스체크 (DOC-17 제2장)
   */
  _startKeepAlive() {
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    this.keepAliveInterval = setInterval(() => {
      if (this.isConnected) {
        this.publishStatus({ status: 'ONLINE', uptime_sec: Math.floor(process.uptime()) });
      }
    }, 30000);
  }

  /**
   * 지수 백오프 자동 재연결
   */
  _scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    console.log(`[TransportClient] ${delay}ms 후 재연결 시도 (${this.reconnectAttempts}회차)...`);
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  /**
   * 1. CTI 발신번호(CID) 클라우드 보고 (Publish)
   * @param {Object} cidEvent
   */
  publishTelephony(cidEvent) {
    const payload = {
      device_id: this.deviceId,
      store_id: this.storeId,
      caller_phone: cidEvent.caller_phone,
      call_time: cidEvent.call_time || new Date().toISOString(),
      ring_count: cidEvent.ring_count || 1,
      line_no: cidEvent.line_no || 1,
    };
    return this._publish(this.topics.telephony, payload);
  }

  /**
   * 2. 단말기 상태 및 하트비트 보고 (Publish)
   * @param {Object} statusData
   */
  publishStatus(statusData) {
    const payload = {
      device_id: this.deviceId,
      store_id: this.storeId,
      timestamp: new Date().toISOString(),
      ...statusData,
    };
    return this._publish(this.topics.status, payload);
  }

  /**
   * 3. OTA 처리 결과 보고 (DOC-17 제5장 Server-based Tracking)
   * @param {Object} otaResult
   */
  publishOtaReport(otaResult) {
    const payload = {
      device_id: this.deviceId,
      store_id: this.storeId,
      content_type: otaResult.content_type || 'firmware',
      target: otaResult.target || 'system',
      version: otaResult.version,
      result: otaResult.result, // 'success' | 'failure'
      error_code: otaResult.error_code || '0x00',
      timestamp: new Date().toISOString(),
    };
    console.log(`[TransportClient] OTA 결과 보고 발행:`, payload);
    return this._publish(this.topics.status, payload);
  }

  /**
   * 내부 발행 헬퍼
   */
  _publish(topic, data) {
    const jsonStr = JSON.stringify(data);
    if (this.simulatorMode || !this.client) {
      console.log(`[TransportClient:SIMULATOR_PUB] -> 토픽: ${topic} | 데이터: ${jsonStr}`);
      return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
      this.client.publish(topic, jsonStr, { qos: 1, retain: false }, (err) => {
        if (err) {
          console.error(`[TransportClient] 발행 실패 (${topic}):`, err);
          return reject(err);
        }
        resolve(true);
      });
    });
  }

  /**
   * 가상 이벤트 주입 (시뮬레이터/테스트 전용)
   */
  injectSimulatedMessage(topic, data) {
    this._handleIncomingMessage(topic, JSON.stringify(data));
  }

  /**
   * 단말기 연결 해제
   */
  disconnect() {
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
    this.isConnected = false;
    console.log('[TransportClient] 연결 정상 종료');
  }
}
