/**
 * AITIP Enterprise IAM (Identity & Access Management) & Audit Log Module
 * 임직원 부서별 세분화된 권한 매트릭스 (운영/CS/정산/영업/개발)
 * 개인정보 열람 및 마스킹 해제 이력, 수수료율 변경 전후 비교 감사 로그 (Audit Log)
 */

import { adminApi } from '../admin-api.js';

export function renderIamAuditView(container) {
  const auditLogs = [
    { id: 'aud_01jcbk9v4e01', timestamp: '2026-11-13 11:42:10', operator: '최태호 (강남대리점장)', action: 'UNMASK_PERSONAL_INFO', target: '라이더 김도현 (010-3841-**** -> 실번호 열람)', reason: '오토바이 배송 중 고객 주소 불일치 유선 통화 지원', ip: '121.134.82.11' },
    { id: 'aud_01jcbk9v4e02', timestamp: '2026-11-13 10:15:33', operator: '김영식 (서울총판장)', action: 'UPDATE_COMMISSION_TARIFF', target: '바른치킨 서초본점 (가맹점 수수료 3.3% -> 3.0% 감면 프로모션)', reason: '강남구 우수 상생가맹점 1호 협약 체결 승인', ip: '211.234.112.50' },
    { id: 'aud_01jcbk9v4e03', timestamp: '2026-11-13 09:20:01', operator: '시스템 운영자 (HQ)', action: 'REBOOT_TERMINAL_MDM', target: '단말기 S/N [POS-2026-0941] (바른치킨 서초본점)', reason: '04시 일일 대사 마감 후 앱 캐시 플러시 재부팅', ip: '10.0.1.5' },
    { id: 'aud_01jcbk9v4e04', timestamp: '2026-11-13 08:50:12', operator: '박진호 (하나로마트 운영팀)', action: 'DOC11_PARTIAL_VOID', target: '주문 ORD-20261113-0810 (성주참외 품절 7,000원 감액)', reason: 'DOC-11 규격 현장 결품 피킹 전표 발행', ip: '10.20.30.15' }
  ];

  container.innerHTML = `
    <div class="panel-card" style="padding: 0; overflow: hidden;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: #fafafa; border-bottom: 1px solid var(--border-default); flex-wrap: wrap; gap: 10px;">
        <div>
          <span class="panel-title">내부 임직원 권한 매트릭스 (RBAC) & 법적 개인정보 보안 감사 로그 (Audit Log)</span>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
            부서별 접근 권한(조회/수정/엑셀다운로드/강제취소) 분리 및 개인정보 마스킹 해제/수수료 변경 전후 추적 로그
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="header-btn" id="btn-export-audit" style="font-size: 11.5px;">국가정보원/KISA 규격 감사원장 다운로드</button>
          <button type="button" class="header-btn header-btn-primary" id="btn-open-login-from-iam" style="font-size: 11.5px;">보안 세션 전환</button>
        </div>
      </div>

      <!-- 2단 그리드: 임직원 권한 매트릭스 vs 실시간 보안 감사 타임라인 -->
      <div style="display: grid; grid-template-columns: 1fr 1.2fr; gap: 20px; padding: 20px;">
        <!-- 왼쪽: 5대 부서별 권한 매트릭스 -->
        <div style="border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
          <div style="font-weight: 800; font-size: 14px; margin-bottom: 12px;">5대 부서별 기능 접근 권한 매트릭스</div>
          <table class="admin-table" style="font-size: 12px;">
            <thead>
              <tr>
                <th>부서 / 직책</th>
                <th>주문 관제</th>
                <th>정산/세무</th>
                <th>단말기 MDM</th>
                <th>마스킹 해제</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 800;">HQ 최고운영자</td>
                <td><span class="badge-status active">전체</span></td>
                <td><span class="badge-status active">전체 승인</span></td>
                <td><span class="badge-status active">전체 제어</span></td>
                <td><span class="badge-status active">가능 (사유기록)</span></td>
              </tr>
              <tr>
                <td style="font-weight: 800;">재무 / 정산팀</td>
                <td><span class="badge-status pending">읽기 전용</span></td>
                <td><span class="badge-status active">정산 확정</span></td>
                <td><span style="color: var(--text-muted);">-</span></td>
                <td><span style="color: var(--text-muted);">-</span></td>
              </tr>
              <tr>
                <td style="font-weight: 800;">고객지원(CS)팀</td>
                <td><span class="badge-status active">강제 취소</span></td>
                <td><span style="color: var(--text-muted);">-</span></td>
                <td><span style="color: var(--text-muted);">-</span></td>
                <td><span class="badge-status active">임시 열람</span></td>
              </tr>
              <tr>
                <td style="font-weight: 800;">인프라 / 기술팀</td>
                <td><span class="badge-status pending">로그 조회</span></td>
                <td><span style="color: var(--text-muted);">-</span></td>
                <td><span class="badge-status active">OTA/재부팅</span></td>
                <td><span style="color: var(--text-muted);">-</span></td>
              </tr>
              <tr>
                <td style="font-weight: 800;">지역 대리점장</td>
                <td><span class="badge-status active">관할 관제</span></td>
                <td><span class="badge-status pending">대리점 정산</span></td>
                <td><span class="badge-status active">관할 단말기</span></td>
                <td><span class="badge-status pending">배송 지원시</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 오른쪽: 실시간 감사 로그 (Audit Log) -->
        <div style="border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;">
          <div style="font-weight: 800; font-size: 14px; margin-bottom: 12px; display: flex; justify-content: space-between;">
            <span>보안 감사 로그 스트림 (위변조 방지 WORM)</span>
            <span style="font-size: 11px; color: #10b981; font-weight: 700;">● 실시간 기록중</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${auditLogs.map(log => `
              <div class="audit-timeline-item">
                <div style="display: flex; justify-content: space-between; align-items: baseline;">
                  <span style="font-weight: 800; font-size: 13px; color: var(--text-primary);">${log.action}</span>
                  <span style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${log.timestamp}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 3px;">
                  조작자: <b>${log.operator}</b> (IP: <code>${log.ip}</code>)
                </div>
                <div style="font-size: 12px; font-weight: 600; color: var(--text-primary); margin-top: 2px;">
                  대상: ${log.target}
                </div>
                <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px; background: #f8fafc; padding: 4px 8px; border-radius: 4px;">
                  사유: ${log.reason}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btn-open-login-from-iam')?.addEventListener('click', () => {
    document.getElementById('login-modal-overlay').style.display = 'flex';
  });

  container.querySelector('#btn-export-audit')?.addEventListener('click', () => {
    alert('개인정보보호법 제29조에 따른 감사원장 암호화 CSV 파일이 생성되었습니다.');
  });
}
