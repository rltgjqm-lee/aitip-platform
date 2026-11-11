/**
 * ============================================================================
 * AITIP Merchant Portal - 고객 리뷰 관리 및 사장님 답글/DOC-12 블라인드 모듈 (ESM)
 * 준수 규격: DOC-02, DOC-12 (24시간 악성리뷰 임시 블라인드 소명 심사)
 * ============================================================================
 */
import { merchantApi } from '../api.js';

let currentReviewFilter = 'ALL';

/**
 * 리뷰 목록 렌더링 및 필터링, 사장님 답글, DOC-12 블라인드 소명 바인딩
 * @param {Object} state
 * @param {string} [filter]
 */
export function renderReviews(state, filter = currentReviewFilter) {
  currentReviewFilter = filter;
  const container = document.getElementById('reviews-list-container');
  if (!container) return;

  container.innerHTML = '';
  const reviews = Array.isArray(state.reviews) ? state.reviews : [];
  let filtered = reviews;
  if (filter === 'NO_REPLY') {
    filtered = reviews.filter(r => !r.owner_reply && !r.reply);
  } else if (filter === 'RATING_5') {
    filtered = reviews.filter(r => (r.product_rating || r.rating) === 5);
  } else if (filter === 'RATING_LOW') {
    filtered = reviews.filter(r => (r.product_rating || r.rating) <= 4);
  }

  document.querySelectorAll('#review-filter-buttons button').forEach(btn => {
    btn.className = (btn.getAttribute('data-filter') === filter) ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm';
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="card"><div class="card-body" style="text-align: center; color: #8b95a1; padding: 30px;">해당 조건의 리뷰가 없습니다.</div></div>`;
    return;
  }

  filtered.forEach(rev => {
    const card = document.createElement('div');
    card.className = 'card';
    const rating = rev.product_rating || rev.rating || 5;
    const author = rev.buyer_name || rev.author || '고객';
    const replyText = rev.owner_reply || rev.reply || '';
    const dateStr = rev.created_at ? new Date(rev.created_at).toLocaleString('ko-KR') : (rev.date || '');

    const isBlind = (rev.blind_status === 'TEMPORARY_BLIND' || rev.blind_status === 'PERMANENT_BLIND');

    card.innerHTML = `
      <div class="card-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="card-title">${author} (평점: ${rating}.0)</span>
          <span style="color: #ffc107; font-weight: 800;">` + '★'.repeat(rating) + `</span>
          ${rev.menu_summary ? `<span class="tag tag-neutral" style="font-size: 11px;">${rev.menu_summary}</span>` : ''}
          ${isBlind ? `<span class="tag tag-pickup" style="font-size: 11px; font-weight: 700; background: #fee2e2; color: #dc2626;">24시간 블라인드 소명 심사중 (소비자 비노출)</span>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 12px; color: #8b95a1;">${dateStr}</span>
          ${!isBlind ? `<button class="btn btn-secondary btn-sm" style="font-size: 11.5px; color: #dc2626; border-color: #fca5a5;" data-blind-review="${rev.id}">악성 소명 (24시간 블라인드)</button>` : ''}
        </div>
      </div>
      <div class="card-body">
        ${isBlind ? `
          <div style="padding: 10px 14px; background: #fff1f2; border: 1px dashed #f43f5e; border-radius: 6px; font-size: 12.5px; color: #9f1239; margin-bottom: 12px;">
            <strong>[DOC-12 소명 신청 완료]</strong> 사유: ${rev.blind_reason || '사유 미기재'} (본사 중재팀 24시간 심사 진행 중)
          </div>
        ` : ''}
        <p style="font-weight: 600; margin-bottom: 12px; font-size: 14px;">${rev.content}</p>
        
        ${replyText ? `
          <div style="background: #fafbfc; padding: 14px; border-radius: 6px; border: 1px solid #e5e8eb;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div style="font-size: 12px; font-weight: 700; color: #2ac1bc;">사장님 답글 (등록 완료)</div>
              <button class="btn btn-secondary btn-sm" data-edit-reply="${rev.id}">답글 수정</button>
            </div>
            <div style="font-size: 13px; color: #4e5968; line-height: 1.5;">${replyText}</div>
          </div>
        ` : `
          <div style="background: #f8fafc; padding: 14px; border-radius: 6px; border: 1px solid #e5e8eb;">
            <div style="font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 6px;">사장님 답글 작성하기</div>
            <textarea class="form-control" id="inp-reply-${rev.id}" rows="2" placeholder="고객님께 감사의 답글을 남겨보세요."></textarea>
            <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
              <button class="btn btn-primary btn-sm" data-save-reply="${rev.id}">답글 등록</button>
            </div>
          </div>
        `}
      </div>
    `;
    container.appendChild(card);

    // DOC-12 악성리뷰 24시간 임시 블라인드 소명 핸들러
    const blindBtn = card.querySelector(`[data-blind-review="${rev.id}"]`);
    if (blindBtn) {
      blindBtn.addEventListener('click', async () => {
        const reason = prompt('악성 리뷰 블라인드 소명 사유를 입력하세요 (예: 사실무근 비방, 경쟁업체 고의 별점 테러, 욕설):');
        if (reason && reason.trim()) {
          try {
            await merchantApi.requestReviewBlind(rev.id, reason.trim());
            rev.blind_status = 'TEMPORARY_BLIND';
            rev.blind_reason = reason.trim();
            renderReviews(state);
            alert('DOC-12 규정에 따라 해당 리뷰가 소비자 화면에서 24시간 동안 즉시 임시 블라인드 처리되었습니다.');
          } catch (err) {
            alert('블라인드 신청 실패: ' + err.message);
          }
        }
      });
    }

    const editReplyBtn = card.querySelector(`[data-edit-reply="${rev.id}"]`);
    if (editReplyBtn) {
      editReplyBtn.addEventListener('click', async () => {
        const newReply = prompt('수정할 답글 내용을 입력하세요:', replyText);
        if (newReply !== null && newReply.trim()) {
          try {
            await merchantApi.replyReview(rev.id, newReply.trim());
            rev.owner_reply = newReply.trim();
            rev.reply = newReply.trim();
            renderReviews(state);
          } catch (err) {
            alert('답글 수정 실패: ' + err.message);
          }
        }
      });
    }

    const saveReplyBtn = card.querySelector(`[data-save-reply="${rev.id}"]`);
    if (saveReplyBtn) {
      saveReplyBtn.addEventListener('click', async () => {
        const inp = card.querySelector(`#inp-reply-${rev.id}`);
        if (inp && inp.value.trim()) {
          try {
            await merchantApi.replyReview(rev.id, inp.value.trim());
            rev.owner_reply = inp.value.trim();
            rev.reply = inp.value.trim();
            renderReviews(state);
          } catch (err) {
            alert('답글 등록 실패: ' + err.message);
          }
        } else {
          alert('답글 내용을 입력해주세요.');
        }
      });
    }
  });
}

/**
 * 리뷰 필터 버튼 이벤트 바인딩
 * @param {Object} state
 */
export function initReviewFilterListeners(state) {
  const reviewFilterBtns = document.querySelectorAll('#review-filter-buttons button');
  reviewFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');
      renderReviews(state, filter);
    });
  });
}
