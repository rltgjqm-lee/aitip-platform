/**
 * ============================================================================
 * [AITIP Core] Pure Node.js Realtime MQTT / WebSocket Bridge (ESM)
 * 준수 규격: DOC-17 (공유기 무설정 아웃바운드 통신), RFC 6455 (WebSocket Protocol)
 * 특성: 외부 의존성(npm) 제로, 순수 Node.js v24 내장 라이브러리 (crypto, events, buffer, http)
 * ============================================================================
 */

import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/**
 * MQTT 와일드카드 매칭 검사
 * '+' : 단일 계층 와일드카드 (aitip/stores/+/orders)
 * '#' : 다중 계층 와일드카드 (aitip/devices/#)
 */
export function matchTopic(pattern, topic) {
  if (pattern === topic || pattern === '#') return true;

  const patternParts = pattern.split('/');
  const topicParts = topic.split('/');

  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    if (p === '#') return true;
    if (p !== '+' && p !== topicParts[i]) return false;
  }

  return patternParts.length === topicParts.length;
}

/**
 * RFC 6455 WebSocket 프레임 인코더 (서버 -> 클라이언트, 마스크 없음)
 */
export function encodeFrame(data, opcode = 0x01) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
  const length = payload.length;

  let header;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode; // FIN + opcode
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payload]);
}

/**
 * RFC 6455 클라이언트 프레임 디코더 스트림
 */
export class FrameParser {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }

  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
  }

  next() {
    if (this.buffer.length < 2) return null;

    const firstByte = this.buffer[0];
    const secondByte = this.buffer[1];

    const fin = (firstByte & 0x80) === 0x80;
    const opcode = firstByte & 0x0f;
    const isMasked = (secondByte & 0x80) === 0x80;
    let payloadLength = secondByte & 0x7f;

    let offset = 2;

    if (payloadLength === 126) {
      if (this.buffer.length < offset + 2) return null;
      payloadLength = this.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLength === 127) {
      if (this.buffer.length < offset + 8) return null;
      payloadLength = Number(this.buffer.readBigUInt64BE(offset));
      offset += 8;
    }

    let maskKey = null;
    if (isMasked) {
      if (this.buffer.length < offset + 4) return null;
      maskKey = this.buffer.subarray(offset, offset + 4);
      offset += 4;
    }

    if (this.buffer.length < offset + payloadLength) return null;

    const rawPayload = this.buffer.subarray(offset, offset + payloadLength);
    const unmasked = Buffer.alloc(payloadLength);

    if (isMasked && maskKey) {
      for (let i = 0; i < payloadLength; i++) {
        unmasked[i] = rawPayload[i] ^ maskKey[i % 4];
      }
    } else {
      rawPayload.copy(unmasked);
    }

    // 소모된 버퍼 정리
    this.buffer = this.buffer.subarray(offset + payloadLength);

    return { fin, opcode, payload: unmasked };
  }
}

/**
 * 실시간 중추망 브릿지 코어
 */
export class AitipMqttBridge extends EventEmitter {
  constructor() {
    super();
    this.clients = new Set();
    this.subscriptions = new Map(); // socket -> Set of topics
  }

  /**
   * HTTP upgrade 이벤트 가로채기
   */
  handleUpgrade(req, socket, head) {
    const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;

    // /ws/mqtt 또는 /ws/realtime 경로만 수용
    if (pathname !== '/ws/mqtt' && pathname !== '/ws/realtime') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    // SHA-1 핸드셰이크 토큰 계산
    const accept = crypto
      .createHash('sha1')
      .update(key + WS_GUID)
      .digest('base64');

    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
    ];

    if (req.headers['sec-websocket-protocol']) {
      const protocols = req.headers['sec-websocket-protocol'].split(',').map((p) => p.trim());
      if (protocols.includes('mqtt')) {
        headers.push('Sec-WebSocket-Protocol: mqtt');
      }
    }

    socket.write(headers.join('\r\n') + '\r\n\r\n');

    this._setupClient(socket, pathname);
  }

  /**
   * 클라이언트 소켓 연결 구성
   */
  _setupClient(socket, path) {
    const parser = new FrameParser();
    this.clients.add(socket);
    this.subscriptions.set(socket, new Set());

    // 기본 구독: 모든 클라이언트는 기본 브로드캐스트 토픽을 들을 수 있음
    socket.on('data', (chunk) => {
      parser.push(chunk);
      let frame;
      while ((frame = parser.next()) !== null) {
        this._handleFrame(socket, frame);
      }
    });

    socket.on('close', () => {
      this.clients.delete(socket);
      this.subscriptions.delete(socket);
    });

    socket.on('error', () => {
      this.clients.delete(socket);
      this.subscriptions.delete(socket);
    });

    // 접속 환영 핸드셰이크 ACK 전송
    const welcome = {
      type: 'CONNECTED',
      status: 'ONLINE',
      server_time: new Date().toISOString(),
      keepalive_sec: 30,
    };
    this._sendTo(socket, welcome);
  }

  /**
   * 인입 프레임 처리
   */
  _handleFrame(socket, frame) {
    // 0x08: Close
    if (frame.opcode === 0x08) {
      socket.write(encodeFrame(Buffer.alloc(0), 0x08));
      socket.end();
      return;
    }

    // 0x09: Ping -> Pong 응답
    if (frame.opcode === 0x09) {
      socket.write(encodeFrame(frame.payload, 0x0a));
      return;
    }

    // 0x01: Text Frame (JSON 패킷 파싱)
    if (frame.opcode === 0x01) {
      try {
        const text = frame.payload.toString('utf-8');
        const msg = JSON.parse(text);

        if (msg.type === 'SUBSCRIBE' && msg.topic) {
          const subs = this.subscriptions.get(socket);
          if (subs) {
            subs.add(msg.topic);
            this._sendTo(socket, { type: 'SUBACK', topic: msg.topic, granted_qos: 1 });
          }
        } else if (msg.type === 'UNSUBSCRIBE' && msg.topic) {
          const subs = this.subscriptions.get(socket);
          if (subs) {
            subs.delete(msg.topic);
            this._sendTo(socket, { type: 'UNSUBACK', topic: msg.topic });
          }
        } else if (msg.type === 'PUBLISH' && msg.topic) {
          // 브릿지를 통한 메시지 발행
          this.publish(msg.topic, msg.payload || msg.data || msg, socket);
        } else if (msg.type === 'PING') {
          this._sendTo(socket, { type: 'PONG', timestamp: Date.now() });
        }
      } catch (err) {
        // 비-JSON 프레임은 무시
      }
    }
  }

  /**
   * 단일 소켓에 JSON 메시지 전송
   */
  _sendTo(socket, obj) {
    if (socket.destroyed || !socket.writable) return;
    try {
      const dataStr = JSON.stringify(obj);
      socket.write(encodeFrame(dataStr, 0x01));
    } catch (e) {
      // 송신 실패 시 조용히 무시
    }
  }

  /**
   * 토픽 브로드캐스트 발행 (Publish)
   * @param {string} topic - 대상 토픽 (예: 'aitip/stores/str_.../orders')
   * @param {Object} payload - 전송할 데이터
   * @param {Object} [senderSocket] - 발행자 소켓 (선택, 자기 자신 제외용)
   */
  publish(topic, payload, senderSocket = null) {
    const packet = {
      type: 'MESSAGE',
      topic,
      payload,
      timestamp: new Date().toISOString(),
    };

    let deliveredCount = 0;

    for (const client of this.clients) {
      if (client === senderSocket) continue;

      const subs = this.subscriptions.get(client);
      let isSubscribed = false;

      if (subs && subs.size > 0) {
        for (const pattern of subs) {
          if (matchTopic(pattern, topic)) {
            isSubscribed = true;
            break;
          }
        }
      } else {
        // 구독이 명시되지 않은 일반 KDS/웹 클라이언트는 모든 주문/전화 토픽 기본 수신
        isSubscribed = true;
      }

      if (isSubscribed) {
        this._sendTo(client, packet);
        deliveredCount++;
      }
    }

    this.emit('publish', { topic, payload, deliveredCount });
    return deliveredCount;
  }

  /**
   * 현재 활성 연결 수
   */
  getClientCount() {
    return this.clients.size;
  }
}

export const mqttBridge = new AitipMqttBridge();
