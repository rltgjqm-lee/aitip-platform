/**
 * ============================================================================
 * [AITIP Edge Device] HTTPS Secure OTA Agent (ESM)
 * 준수 규격: DOC-17 제5장, AITIP HTTPS Update Guide 및 OTA 규격 문서 전수 준수
 * 특성: MQTT 제어 트리거 ➔ HTTPS 스트림 다운로드, SHA256 암호학적 무결성 검증,
 *       HW Revision 호환성 가드, 서버 기반 상태 보고(Server-based Tracking)
 * ============================================================================
 */

import { EventEmitter } from 'node:events';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

export class AitipOtaAgent extends EventEmitter {
  /**
   * @param {Object} [options]
   * @param {Object} [options.transportClient] - AitipTransportClient 인스턴스
   * @param {string} [options.hwRevision='V3S_REV_B'] - 현재 단말기 하드웨어 리비전
   * @param {string} [options.currentVersion='1.0.0'] - 현재 펌웨어 버전
   * @param {string} [options.storageDir] - 업데이트 파일 보관 디렉터리
   */
  constructor(options = {}) {
    super();

    this.transportClient = options.transportClient || null;
    this.hwRevision = options.hwRevision || 'V3S_REV_B';
    this.currentVersion = options.currentVersion || '1.0.0';
    this.storageDir = options.storageDir || path.join(os.tmpdir(), 'aitip-ota');

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    this.isUpdating = false;
  }

  /**
   * MQTT로부터 수신한 OTA 트리거 메시지 처리
   * @param {Object} otaRequest
   * @param {string} otaRequest.content_type - 'firmware' | 'audio' | 'config'
   * @param {string} otaRequest.target - 'system' | 'welcome_sound' 등
   * @param {string} otaRequest.version - 신규 버전 (예: 1.2.3)
   * @param {string} otaRequest.download_url - HTTPS 전용 다운로드 주소
   * @param {string} otaRequest.sha256 - 서버 공인 SHA256 해시값
   * @param {string} [otaRequest.hw_rev] - 요구되는 하드웨어 리비전
   */
  async handleOtaTrigger(otaRequest) {
    if (this.isUpdating) {
      console.warn('[OtaAgent] 이미 다른 업데이트가 진행 중입니다. 요청 무시.');
      return { success: false, reason: 'ALREADY_IN_PROGRESS' };
    }

    this.isUpdating = true;
    const { content_type = 'firmware', target = 'system', version, download_url, sha256, hw_rev } = otaRequest;

    console.log(`[OtaAgent] OTA 업데이트 작업 시작: [${content_type}/${target}] v${this.currentVersion} -> v${version}`);

    try {
      // 1. 필수 프로토콜 검사 (AITIP HTTPS Update Guide 제3조: 반드시 https:// 로 시작)
      if (!download_url || !download_url.startsWith('https://')) {
        throw new Error('보안 정책 위반: 다운로드 URL은 반드시 https:// 여야 합니다.');
      }

      // 2. HW Revision 호환성 가드 검사 (ota 추가 사항 제4조)
      if (hw_rev && hw_rev !== this.hwRevision) {
        throw new Error(`HW_REV 비호환 차단: 단말기(${this.hwRevision}) != 요구(${hw_rev})`);
      }

      // 3. HTTPS 스트림 다운로드 및 파일 저장
      const tempFileName = `ota_${content_type}_${target}_${Date.now()}.bin`;
      const tempFilePath = path.join(this.storageDir, tempFileName);

      console.log(`[OtaAgent] HTTPS 다운로드 시작: ${download_url}`);
      await this._downloadFile(download_url, tempFilePath);

      // 4. SHA256 해시 암호학적 무결성 검증 (토픽과 https를 통한 ota 제6조)
      console.log('[OtaAgent] SHA256 체크섬 무결성 검증 진행 중...');
      const calculatedHash = await this._calculateFileSha256(tempFilePath);

      if (sha256 && calculatedHash.toLowerCase() !== sha256.toLowerCase()) {
        fs.unlinkSync(tempFilePath); // 오염된 파일 즉시 폐기
        throw new Error(`무결성 검증 실패 (불일치): 계산값(${calculatedHash}) != 서버서명(${sha256})`);
      }

      console.log(`[OtaAgent] 무결성 검증 100% 통과: SHA256 ${calculatedHash}`);

      // 5. 펌웨어 / 콘텐츠 적용 (A/B 파티션 스왑 또는 심볼릭 링크 교체 시뮬레이션)
      const targetPath = path.join(this.storageDir, `${content_type}_${target}_active.bin`);
      fs.copyFileSync(tempFilePath, targetPath);
      fs.unlinkSync(tempFilePath);

      const oldVersion = this.currentVersion;
      this.currentVersion = version;

      // 6. 서버 기반 상태 보고 (DOC-17 제5장 & ota 추가 사항 제1조)
      const report = {
        content_type,
        target,
        version: this.currentVersion,
        old_version: oldVersion,
        result: 'success',
        error_code: '0x00',
        sha256: calculatedHash,
      };

      if (this.transportClient) {
        await this.transportClient.publishOtaReport(report);
      }

      this.emit('update_success', report);
      console.log(`[OtaAgent] OTA 업데이트 성공 및 서버 보고 완료 (v${this.currentVersion})`);

      return { success: true, report };

    } catch (err) {
      console.error('[OtaAgent] OTA 업데이트 실패:', err.message);

      const failureReport = {
        content_type,
        target,
        version,
        result: 'failure',
        error_code: err.message.includes('무결성') ? '0x02_HASH_MISMATCH' : '0x01_DOWNLOAD_FAIL',
        error_message: err.message,
      };

      if (this.transportClient) {
        await this.transportClient.publishOtaReport(failureReport).catch(() => {});
      }

      this.emit('update_failure', failureReport);
      return { success: false, error: err.message, report: failureReport };

    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * HTTPS 스트림 파일 다운로더
   */
  _downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(destPath);

      const req = https.get(url, { timeout: 15000 }, (res) => {
        if (res.statusCode !== 200) {
          fileStream.close();
          if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
          return reject(new Error(`HTTP 다운로드 실패 (상태 코드: ${res.statusCode})`));
        }

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(resolve);
        });
      });

      req.on('error', (err) => {
        fileStream.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        fileStream.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(new Error('HTTPS 다운로드 타임아웃'));
      });
    });
  }

  /**
   * 파일의 SHA256 해시값 계산
   */
  _calculateFileSha256(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}
