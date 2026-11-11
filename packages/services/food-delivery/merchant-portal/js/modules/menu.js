/**
 * ============================================================================
 * AITIP Merchant Portal - 메뉴판 통합 관리 및 옵션 그룹 모듈 (ESM)
 * 준수 규격: DOC-08 (메뉴-옵션 3계층 트리, N-out-of-M 제약조건, PWA 프리뷰)
 * ============================================================================
 */
import { merchantApi } from '../api.js';

export function renderMenuGroupBlocks(state) {
  const container = document.getElementById('menu-group-blocks-container');
  if (!container) return;

  container.innerHTML = '';

  state.categories.forEach((cat, idx) => {
    const block = document.createElement('div');
    block.className = 'menu-group-block';

    const catProducts = state.products.filter(p => p.category_id === cat.id);

    block.innerHTML = `
      <div class="menu-group-block-header">
        <div class="group-header-info">
          <span class="category-order-badge">${idx + 1}</span>
          <span class="group-name">${cat.name}</span>
          <span class="group-item-count">${catProducts.length}개 메뉴</span>
          <span class="category-desc">${cat.description || ''}</span>
        </div>
        <div class="group-header-actions">
          <button class="btn btn-secondary btn-sm" data-move-up="${cat.id}" ${idx === 0 ? 'disabled' : ''}>▲</button>
          <button class="btn btn-secondary btn-sm" data-move-down="${cat.id}" ${idx === state.categories.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="btn btn-secondary btn-sm" data-add-menu-to="${cat.id}">+ 이 그룹에 메뉴 등록</button>
          <button class="btn btn-secondary btn-sm" data-del-cat="${cat.id}">삭제</button>
        </div>
      </div>
      <div class="menu-group-block-body">
        ${catProducts.length === 0 ? `
          <div class="empty-group-box">
            이 대분류에 등록된 메뉴가 없습니다. 우측 상단의 <strong>[+ 이 그룹에 메뉴 등록]</strong> 버튼을 눌러 추가하세요.
          </div>
        ` : `
          <div class="menu-items-list">
            ${catProducts.map(p => {
              const isSoldOut = p.status === 'SOLDOUT';
              return `
                <div class="menu-item-row" id="row-${p.product_id}">
                  <img src="${p.image_url || 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=150'}" class="menu-thumb" alt="${p.name}" title="클릭하여 상세 정보 및 사진 수정">
                  <div class="menu-info-col" title="클릭하여 상세 정보 및 옵션 수정">
                    <div class="menu-title-line">
                      <span class="menu-title-text">${p.name}</span>
                      <span class="tag ${p.channel === 'TAKEOUT_ONLY' ? 'tag-pickup' : 'tag-mint'}">
                        ${p.channel === 'TAKEOUT_ONLY' ? '포장전용' : p.channel === 'DELIVERY_ONLY' ? '배달전용' : '배달+포장'}
                      </span>
                      ${p.discount_price ? `<span class="tag tag-neutral" style="color: #f04452; font-weight: 700;">할인중</span>` : ''}
                    </div>
                    <div class="menu-desc-text">${p.description || '메뉴 설명 없음'}</div>
                    <div class="menu-options-line">
                      <span class="tag tag-neutral">소분류: ${p.subcategory || '대표메뉴'}</span>
                      <span class="tag tag-neutral">부위선택 (필수)</span>
                      <span class="tag tag-neutral">소스/토핑 (선택)</span>
                      ${p.schedule && p.schedule.enabled ? `<span class="tag tag-neutral" style="color: #00827b;">특선스케줄</span>` : ''}
                    </div>
                  </div>
                  <div>
                    <div style="font-size: 11px; color: #8b95a1; margin-bottom: 2px;">판매가격 (원)</div>
                    <input type="number" class="inline-input" value="${p.price}" data-id="${p.product_id}" style="width: 105px; text-align: right; font-weight: 800; font-size: 14px;">
                  </div>
                  <div style="text-align: center;">
                    <div style="font-size: 11px; color: #8b95a1; margin-bottom: 4px;">판매 상태</div>
                    <button class="btn ${isSoldOut ? 'btn-secondary' : 'btn-primary'} btn-sm" data-toggle-soldout="${p.product_id}" style="width: 75px;">
                      ${isSoldOut ? '품절중' : '판매중'}
                    </button>
                  </div>
                  <div style="display: flex; gap: 6px; justify-content: flex-end;">
                    <button class="btn btn-secondary btn-sm" data-edit-product="${p.product_id}" style="padding: 6px 10px;">상세수정</button>
                    <button class="btn btn-secondary btn-sm" data-del-product="${p.product_id}" style="padding: 6px 10px;">삭제</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    container.appendChild(block);

    // 대분류 순서 변경 & 삭제
    block.querySelector(`[data-del-cat="${cat.id}"]`).addEventListener('click', () => {
      if (confirm(`'${cat.name}' 대분류를 삭제하시겠습니까?`)) {
        state.categories = state.categories.filter(c => c.id !== cat.id);
        renderMenuGroupBlocks(state);
        renderCategoryDropdowns(state);
      }
    });

    const moveUpBtn = block.querySelector(`[data-move-up="${cat.id}"]`);
    if (moveUpBtn && idx > 0) {
      moveUpBtn.addEventListener('click', () => {
        const temp = state.categories[idx - 1];
        state.categories[idx - 1] = state.categories[idx];
        state.categories[idx] = temp;
        renderMenuGroupBlocks(state);
      });
    }

    const moveDownBtn = block.querySelector(`[data-move-down="${cat.id}"]`);
    if (moveDownBtn && idx < state.categories.length - 1) {
      moveDownBtn.addEventListener('click', () => {
        const temp = state.categories[idx + 1];
        state.categories[idx + 1] = state.categories[idx];
        state.categories[idx] = temp;
        renderMenuGroupBlocks(state);
      });
    }

    // 이 그룹에 메뉴 등록
    block.querySelector(`[data-add-menu-to="${cat.id}"]`).addEventListener('click', () => {
      renderCategoryDropdowns(state);
      const catSelect = document.getElementById('menu-input-category');
      if (catSelect) {
        catSelect.value = cat.id;
        updateSubcategoryDropdown(cat.id, state);
      }
      document.getElementById('modal-create-menu').classList.add('show');
    });

    // 개별 메뉴 가격/상태/상세수정
    catProducts.forEach(p => {
      const priceInput = block.querySelector(`input[data-id="${p.product_id}"]`);
      if (priceInput) {
        priceInput.addEventListener('change', async (e) => {
          const newPrice = Number(e.target.value);
          if (newPrice > 0) {
            try {
              await merchantApi.updatePrice(p.product_id, newPrice);
              p.price = newPrice;
            } catch (err) {
              alert('가격 수정 실패: ' + err.message);
            }
          }
        });
      }

      const toggleBtn = block.querySelector(`button[data-toggle-soldout="${p.product_id}"]`);
      if (toggleBtn) {
        toggleBtn.addEventListener('click', async () => {
          const nextStatus = p.status === 'SOLDOUT' ? 'AVAILABLE' : 'SOLDOUT';
          try {
            await merchantApi.updateStatus(p.product_id, nextStatus);
            p.status = nextStatus;
            renderMenuGroupBlocks(state);
          } catch (err) {
            alert('상태 변경 실패: ' + err.message);
          }
        });
      }

      const delProdBtn = block.querySelector(`button[data-del-product="${p.product_id}"]`);
      if (delProdBtn) {
        delProdBtn.addEventListener('click', () => {
          if (confirm(`'${p.name}' 메뉴를 메뉴판에서 삭제하시겠습니까?`)) {
            state.products = state.products.filter(item => item.product_id !== p.product_id);
            renderMenuGroupBlocks(state);
          }
        });
      }

      const rowThumb = block.querySelector(`#row-${p.product_id} .menu-thumb`);
      const rowInfo = block.querySelector(`#row-${p.product_id} .menu-info-col`);
      const editBtn = block.querySelector(`button[data-edit-product="${p.product_id}"]`);
      [rowThumb, rowInfo, editBtn].forEach(el => {
        if (el) {
          el.addEventListener('click', () => openEditMenuModal(p.product_id, state));
        }
      });
    });
  });
}

export function openEditMenuModal(productId, state) {
  const p = state.products.find(item => item.product_id === productId);
  if (!p) return;

  const modal = document.getElementById('modal-edit-menu');
  if (!modal) return;

  document.getElementById('edit-menu-id').value = p.product_id;
  document.getElementById('edit-menu-uid-badge').textContent = `UID: ${p.product_id}`;

  const defaultImg = p.image_url || 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=150';
  const preview = document.getElementById('edit-image-preview');
  if (preview) preview.src = defaultImg;
  const urlInp = document.getElementById('edit-image-url');
  if (urlInp) urlInp.value = p.image_url || '';

  const catSelect = document.getElementById('edit-menu-category');
  catSelect.innerHTML = state.categories.map(c => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${c.name}</option>`).join('');

  const subcatSelect = document.getElementById('edit-menu-subcategory');
  const updateEditSubcats = (catId) => {
    const selCat = state.categories.find(c => c.id === catId);
    const subs = selCat && selCat.subcategories ? selCat.subcategories : ['대표메뉴', '인기메뉴', '일반메뉴'];
    subcatSelect.innerHTML = subs.map(s => `<option value="${s}" ${s === p.subcategory ? 'selected' : ''}>${s}</option>`).join('');
  };
  updateEditSubcats(p.category_id);
  catSelect.onchange = (e) => updateEditSubcats(e.target.value);

  document.getElementById('edit-menu-name').value = p.name || '';
  document.getElementById('edit-menu-channel').value = p.channel || 'ALL';
  document.getElementById('edit-menu-price').value = p.price || 0;
  document.getElementById('edit-menu-discount').value = p.discount_price || '';
  document.getElementById('edit-menu-desc').value = p.description || '';

  if (p.status === 'SOLDOUT') {
    document.getElementById('edit-status-soldout').checked = true;
  } else {
    document.getElementById('edit-status-available').checked = true;
  }

  const checkOptPart = document.getElementById('edit-check-opt-part');
  const checkOptSauce = document.getElementById('edit-check-opt-sauce');
  if (checkOptPart) checkOptPart.checked = true;
  if (checkOptSauce) checkOptSauce.checked = true;

  const schedCheck = document.getElementById('edit-menu-check-schedule');
  const schedBox = document.getElementById('edit-menu-schedule-box');
  const schedChips = document.querySelectorAll('#edit-menu-schedule-days .schedule-day-chip');

  if (p.schedule && p.schedule.enabled) {
    schedCheck.checked = true;
    schedBox.style.display = 'block';
    schedChips.forEach(chip => {
      const day = Number(chip.getAttribute('data-day'));
      chip.classList.toggle('active', (p.schedule.days || []).includes(day));
    });
    document.getElementById('edit-menu-schedule-start').value = p.schedule.start || '11:00';
    document.getElementById('edit-menu-schedule-end').value = p.schedule.end || '14:00';
  } else {
    schedCheck.checked = false;
    schedBox.style.display = 'none';
    schedChips.forEach(chip => chip.classList.add('active'));
  }

  modal.classList.add('show');
}

export async function handleSaveEditMenu(state) {
  const productId = document.getElementById('edit-menu-id').value;
  const p = state.products.find(item => item.product_id === productId);
  if (!p) return;

  const newName = document.getElementById('edit-menu-name').value.trim();
  const newCat = document.getElementById('edit-menu-category').value;
  const newSubcat = document.getElementById('edit-menu-subcategory').value;
  const newChannel = document.getElementById('edit-menu-channel').value;
  const newPrice = Number(document.getElementById('edit-menu-price').value);
  const discountVal = document.getElementById('edit-menu-discount').value.trim();
  const newDiscount = discountVal ? Number(discountVal) : null;
  const newDesc = document.getElementById('edit-menu-desc').value.trim();
  const newStatus = document.getElementById('edit-status-soldout').checked ? 'SOLDOUT' : 'AVAILABLE';
  const newImgUrl = document.getElementById('edit-image-url').value.trim();

  if (!newName) {
    alert('메뉴명을 입력해주세요.');
    return;
  }
  if (!newPrice || newPrice <= 0) {
    alert('정상 판매가격을 입력해주세요.');
    return;
  }

  p.name = newName;
  p.category_id = newCat;
  p.subcategory = newSubcat;
  p.channel = newChannel;
  p.price = newPrice;
  p.discount_price = newDiscount;
  p.description = newDesc;
  p.status = newStatus;
  if (newImgUrl) p.image_url = newImgUrl;

  const schedCheck = document.getElementById('edit-menu-check-schedule');
  if (schedCheck && schedCheck.checked) {
    const activeDays = Array.from(document.querySelectorAll('#edit-menu-schedule-days .schedule-day-chip.active')).map(c => Number(c.getAttribute('data-day')));
    p.schedule = {
      enabled: true,
      days: activeDays,
      start: document.getElementById('edit-menu-schedule-start').value,
      end: document.getElementById('edit-menu-schedule-end').value
    };
  } else {
    p.schedule = { enabled: false };
  }

  try {
    await merchantApi.updatePrice(p.product_id, newPrice);
    await merchantApi.updateStatus(p.product_id, newStatus);
  } catch (err) {
    console.warn('[Menu] 서버 가격/상태 동기화 경고:', err.message);
  }

  document.getElementById('modal-edit-menu').classList.remove('show');
  renderMenuGroupBlocks(state);
}

export function handleDeleteMenuFromModal(state) {
  const productId = document.getElementById('edit-menu-id').value;
  const p = state.products.find(item => item.product_id === productId);
  if (!p) return;

  if (confirm(`'${p.name}' 메뉴를 메뉴판에서 완전히 삭제하시겠습니까?`)) {
    state.products = state.products.filter(item => item.product_id !== productId);
    document.getElementById('modal-edit-menu').classList.remove('show');
    renderMenuGroupBlocks(state);
  }
}

export function renderCategoryDropdowns(state) {
  const catSelect = document.getElementById('menu-input-category');
  if (!catSelect) return;

  catSelect.innerHTML = '';
  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    catSelect.appendChild(opt);
  });

  if (state.categories.length > 0) {
    updateSubcategoryDropdown(state.categories[0].id, state);
  }
}

export function updateSubcategoryDropdown(catId, state) {
  const subSelect = document.getElementById('menu-input-subcategory');
  if (!subSelect) return;

  subSelect.innerHTML = '';
  const selectedCat = state.categories.find(c => c.id === catId);
  const subs = selectedCat && selectedCat.subcategories ? selectedCat.subcategories : ['대표메뉴'];

  subs.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    subSelect.appendChild(opt);
  });
}

export async function handleCreateCategory(state) {
  const name = document.getElementById('cat-input-name').value.trim();
  const desc = document.getElementById('cat-input-desc').value.trim();

  if (!name) {
    alert('대분류명을 입력해 주세요.');
    return;
  }

  try {
    const res = await merchantApi.createCategory({ name });
    const newCat = res.category;
    newCat.description = desc;
    newCat.subcategories = ['대표메뉴', '추천메뉴'];

    state.categories.push(newCat);
    renderMenuGroupBlocks(state);
    renderCategoryDropdowns(state);

    document.getElementById('cat-input-name').value = '';
    document.getElementById('cat-input-desc').value = '';
    document.getElementById('modal-create-category').classList.remove('show');
  } catch (err) {
    alert('대분류 등록 실패: ' + err.message);
  }
}

export async function handleCreateMenu(state) {
  const name = document.getElementById('menu-input-name').value.trim();
  const desc = document.getElementById('menu-input-desc').value.trim();
  const price = document.getElementById('menu-input-price').value.trim();
  const catId = document.getElementById('menu-input-category').value;
  const subCat = document.getElementById('menu-input-subcategory').value;
  const channel = document.getElementById('menu-input-channel').value;

  const scheduleEnabled = document.getElementById('menu-check-schedule')?.checked || false;
  let schedule = null;
  if (scheduleEnabled) {
    const activeDays = Array.from(document.querySelectorAll('#menu-schedule-days .schedule-day-chip.active'))
      .map(c => Number(c.getAttribute('data-day')));
    schedule = {
      enabled: true,
      days: activeDays,
      start_time: document.getElementById('menu-schedule-start')?.value || '11:00',
      end_time: document.getElementById('menu-schedule-end')?.value || '14:00'
    };
  }

  if (!name || !price) {
    alert('메뉴명과 판매가격을 입력해 주세요.');
    return;
  }

  try {
    const res = await merchantApi.createMenuItem({
      name,
      description: desc,
      price: Number(price),
      category_id: catId
    });

    const newPrd = res.product;
    newPrd.subcategory = subCat;
    newPrd.channel = channel;
    newPrd.schedule = schedule;
    state.products.push(newPrd);
    renderMenuGroupBlocks(state);

    document.getElementById('menu-input-name').value = '';
    document.getElementById('menu-input-desc').value = '';
    document.getElementById('menu-input-price').value = '';
    document.getElementById('modal-create-menu').classList.remove('show');
  } catch (err) {
    alert('메뉴 등록 실패: ' + err.message);
  }
}

export function renderOptionGroups(state) {
  const container = document.getElementById('option-groups-container');
  if (!container) return;

  container.innerHTML = '';
  state.optionGroups.forEach(grp => {
    const card = document.createElement('div');
    card.className = 'card';
    const groupId = grp.group_id || grp.id;
    const groupName = grp.group_name || grp.name;
    const isRequired = grp.is_required || grp.type === 'REQUIRED_SINGLE';
    const options = grp.options || (grp.items ? grp.items.map(it => ({ option_id: it.id, option_name: it.name, additional_price: it.price })) : []);

    card.innerHTML = `
      <div class="card-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="card-title">${groupName} (${isRequired ? '필수 선택 · 택 1' : '선택 옵션 · 다중 선택'})</span>
          <span class="tag tag-mint">ID: ${groupId}</span>
        </div>
        <button class="btn btn-secondary btn-sm" data-del-opt-group="${groupId}">그룹 삭제</button>
      </div>
      <div class="card-body">
        <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
          ${options.map(it => `
            <span class="tag tag-neutral" style="font-size: 13px; padding: 6px 12px;">
              ${it.option_name || it.name} (${Number(it.additional_price || it.price || 0) === 0 ? '기본, +0원' : `+${Number(it.additional_price || it.price).toLocaleString()}원`})
            </span>
          `).join('')}
          <button class="btn btn-secondary btn-sm" data-add-item-to="${groupId}">+ 세부항목 추가</button>
        </div>
      </div>
    `;
    container.appendChild(card);

    card.querySelector(`[data-del-opt-group="${groupId}"]`).addEventListener('click', () => {
      if (confirm(`'${groupName}' 옵션 그룹을 삭제하시겠습니까?`)) {
        state.optionGroups = state.optionGroups.filter(g => (g.group_id || g.id) !== groupId);
        renderOptionGroups(state);
      }
    });

    card.querySelector(`[data-add-item-to="${groupId}"]`).addEventListener('click', () => {
      const itemName = prompt('추가할 옵션 항목명을 입력하세요:');
      if (!itemName) return;
      const itemPrice = prompt('추가 금액(원)을 입력하세요:', '0');
      options.push({ option_name: itemName.trim(), additional_price: Number(itemPrice) || 0 });
      renderOptionGroups(state);
    });
  });
}

export async function handleCreateOptionGroup(state) {
  const name = document.getElementById('opt-group-input-name').value.trim();
  const type = document.getElementById('opt-group-input-type').value;

  if (!name) {
    alert('옵션 그룹명을 입력해주세요.');
    return;
  }

  const isRequired = (type === 'REQUIRED_SINGLE');
  try {
    const res = await merchantApi.createOptionGroup({
      group_name: name,
      is_required: isRequired,
      min_select: isRequired ? 1 : 0,
      max_select: isRequired ? 1 : 5,
      options: [
        { option_name: '기본 선택', additional_price: 0, is_default: true }
      ]
    });

    state.optionGroups.push(res.option_group);
    renderOptionGroups(state);
    document.getElementById('opt-group-input-name').value = '';
    document.getElementById('modal-create-option-group').classList.remove('show');
  } catch (err) {
    alert('옵션 그룹 등록 실패: ' + err.message);
  }
}

export function renderPwaSimulator(state) {
  const screen = document.getElementById('pwa-simulator-screen');
  if (!screen) return;

  const store = state.store || { store_name: '바른치킨 서초본점' };
  const blocks = store.blocks || {
    notice: '신선하고 정직한 재료로 정성을 다해 모시겠습니다.',
    parking: { type: 'FREE', capacity_text: '매장 앞 4대 무료 주차', details: '만차 시 인근 서초 공영주차장 1시간 지원' },
    location_guide: { subway_station: '2호선 서초역 1번 출구', walking_time_minutes: 3, landmark_hint: '서초대로 34길 우리은행 골목 진입 후 50m 우측 1층' },
    facilities: ['parking', 'wifi', 'group_seat', 'reservation', 'separate_restroom', 'zero_pay'],
    legal_notices: { origin_or_license: '닭고기(국내산 100%), 쌀(국내산), 배추김치(국내산)' }
  };
  const totalCount = state.products.length;

  let activePwaMode = 'DELIVERY'; // 'DELIVERY' | 'TAKEOUT' | 'DINE_IN'
  let activePwaMainTab = 'MENU'; // 'MENU' | 'INFO' | 'REVIEWS'

  const renderPwaContent = () => {
    let modeTag = '배달 주문';
    if (activePwaMode === 'TAKEOUT') modeTag = '포장 픽업';
    if (activePwaMode === 'DINE_IN') modeTag = '매장식사 · 테이블 예약';

    let mainTabContentHtml = '';

    if (activePwaMainTab === 'MENU') {
      mainTabContentHtml = `
        <!-- 홀/테이블 예약 선택 패널 (DINE_IN 선택 시 상단에 노출) -->
        ${activePwaMode === 'DINE_IN' ? `
          <div style="background: #faf5ff; border: 1.5px solid #c4b5fd; border-radius: 8px; padding: 12px; margin: 10px 14px 6px;">
            <div style="font-weight: 800; font-size: 13px; color: #6d28d9; margin-bottom: 8px; display: flex; justify-content: space-between;">
              <span>매장 식사 / 테이블 예약 설정</span>
              <span style="font-size: 11px; background: #ede9fe; color: #5b21b6; padding: 2px 6px; border-radius: 4px;">선주문 조리</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px; margin-bottom: 8px;">
              <div>
                <label style="font-size: 11px; font-weight: 700; color: #4b5563;">방문 시각</label>
                <select class="form-control" id="pwa-select-res-time" style="font-size: 12px; padding: 4px 6px;">
                  <option value="18:30">오늘 18:30 (여유)</option>
                  <option value="19:00">오늘 19:00 (여유)</option>
                  <option value="19:30" selected>오늘 19:30 (추천)</option>
                  <option value="20:00">오늘 20:00 (예약마감 임박)</option>
                </select>
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 700; color: #4b5563;">방문 인원</label>
                <select class="form-control" id="pwa-select-guest-count" style="font-size: 12px; padding: 4px 6px;">
                  <option value="2">성인 2명</option>
                  <option value="4" selected>성인 4명 (창가석)</option>
                  <option value="6">성인 6명 (단체)</option>
                  <option value="8">성인 8명 (VIP 룸)</option>
                </select>
              </div>
            </div>
            <div style="font-size: 11px; color: #7c3aed;">
              * 테이블 착석 후 도착 즉시 메뉴가 서빙되도록 주방에 자동 전송됩니다.
            </div>
          </div>
        ` : ''}

        <!-- 카테고리 필터 바 -->
        <div class="mobile-category-bar">
          <button class="mobile-category-pill active" data-pwa-cat="all">전체 (${totalCount})</button>
          ${state.categories.map(c => {
            const count = state.products.filter(p => p.category_id === c.id).length;
            return `<button class="mobile-category-pill" data-pwa-cat="${c.id}">${c.name} (${count})</button>`;
          }).join('')}
        </div>

        <!-- 메뉴 목록 -->
        <div style="padding: 6px 0;">
          ${state.categories.map(c => {
            const catPrds = state.products.filter(p => p.category_id === c.id);
            if (catPrds.length === 0) return '';
            return `
              <div class="pwa-category-section" id="pwa-sec-${c.id}">
                <div style="padding: 10px 14px 6px; font-size: 14px; font-weight: 800; color: #191f28; border-bottom: 2px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center;">
                  <span>${c.name}</span>
                  <span style="font-size: 11px; font-weight: 600; color: #8b95a1;">${catPrds.length}개</span>
                </div>
                ${catPrds.map(p => {
                  const isSold = p.status === 'SOLDOUT';
                  return `
                    <div class="mobile-food-card ${isSold ? 'soldout' : ''}">
                      <div class="mobile-food-info">
                        <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 3px;">
                          <span class="mobile-food-title">${p.name}</span>
                          ${p.channel === 'TAKEOUT_ONLY' ? '<span class="tag tag-pickup" style="font-size: 9.5px; padding: 1px 4px;">포장전용</span>' : ''}
                          ${p.channel === 'DELIVERY_ONLY' ? '<span class="tag tag-mint" style="font-size: 9.5px; padding: 1px 4px;">배달전용</span>' : ''}
                        </div>
                        <div class="mobile-food-desc">${p.description || '신선하고 바삭하게 바로 조리한 대표 메뉴'}</div>
                        <div style="display: flex; align-items: baseline; gap: 6px; margin-top: 4px;">
                          <span class="mobile-food-price">${p.price.toLocaleString()}원</span>
                          ${p.discount_price ? `<span style="font-size: 11px; text-decoration: line-through; color: #8b95a1;">${p.discount_price.toLocaleString()}원</span>` : ''}
                        </div>
                      </div>
                      <div style="position: relative; width: 80px; height: 80px; flex-shrink: 0;">
                        <img src="${p.image_url || 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=150'}" class="mobile-food-thumb" alt="${p.name}">
                        ${isSold ? `
                          <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.65); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-size: 12px; letter-spacing: -0.5px;">
                            품절
                          </div>
                        ` : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (activePwaMainTab === 'INFO') {
      // 2. 가맹점 정보 / 위치 / 주차 / 편의시설 탭
      mainTabContentHtml = `
        <div style="padding: 14px; background: #ffffff;">
          <!-- 사장님 공지 배너 -->
          ${blocks.notice ? `
            <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px; margin-bottom: 14px;">
              <div style="font-weight: 800; font-size: 12.5px; color: #b45309; margin-bottom: 4px;">사장님 알림 공지</div>
              <div style="font-size: 12px; color: #92400e; line-height: 1.5;">${blocks.notice}</div>
            </div>
          ` : ''}

          <!-- 위치 및 길찾기 블록 -->
          <div style="margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #f1f3f5;">
            <div style="font-weight: 800; font-size: 13.5px; color: #191f28; margin-bottom: 6px;">위치 및 오시는 길</div>
            <div style="font-size: 12.5px; color: #4e5968; margin-bottom: 4px;">${store.address || '서울특별시 서초구 서초대로 34길 18 1층'}</div>
            <div style="font-size: 12px; color: #0284c7; font-weight: 700; margin-bottom: 4px;">
              지하철: ${blocks.location_guide?.subway_station || '서초역 1번 출구'} 도보 ${blocks.location_guide?.walking_time_minutes || 3}분
            </div>
            <div style="font-size: 11.5px; color: #8b95a1;">${blocks.location_guide?.landmark_hint || '우리은행 서초대로 골목 안쪽'}</div>
          </div>

          <!-- 주차 안내 블록 -->
          <div style="margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #f1f3f5;">
            <div style="font-weight: 800; font-size: 13.5px; color: #191f28; margin-bottom: 6px;">주차 안내</div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span class="tag" style="background: ${blocks.parking?.type === 'UNAVAILABLE' ? '#fee2e2' : '#dcfce7'}; color: ${blocks.parking?.type === 'UNAVAILABLE' ? '#991b1b' : '#166534'}; font-weight: 800; font-size: 11px;">
                ${blocks.parking?.type === 'FREE' ? '무료 주차 가능' : (blocks.parking?.type === 'PAID' ? '유료 주차' : (blocks.parking?.type === 'VALET' ? '발렛 파킹' : '주차 불가'))}
              </span>
              <span style="font-size: 12.5px; font-weight: 700; color: #191f28;">${blocks.parking?.capacity_text || '매장 앞 4대'}</span>
            </div>
            <div style="font-size: 12px; color: #4e5968;">${blocks.parking?.details || '만차 시 인근 공영주차장 이용 권장'}</div>
          </div>

          <!-- 편의시설 태그 블록 -->
          <div style="margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #f1f3f5;">
            <div style="font-weight: 800; font-size: 13.5px; color: #191f28; margin-bottom: 8px;">매장 편의시설</div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${(blocks.facilities || ['parking', 'wifi', 'group_seat', 'reservation']).map(f => {
                const labels = { parking: '주차가능', wifi: '무선인터넷', group_seat: '단체석', reservation: '예약가능', baby_chair: '유아의자', pet_friendly: '반려동물', separate_restroom: '남녀화장실', zero_pay: '제로페이/지역화폐' };
                return `<span style="font-size: 11px; padding: 3px 8px; background: #f1f5f9; color: #334155; border-radius: 4px; font-weight: 600;">${labels[f] || f}</span>`;
              }).join('')}
            </div>
          </div>

          <!-- 가맹점 사업자 정보 -->
          <div style="font-size: 11.5px; color: #8b95a1; line-height: 1.6;">
            <div>상호: ${store.store_name} | 대표자: ${store.owner_name || '홍길동'}</div>
            <div>사업자등록번호: ${store.biz_number || '214-88-59124'}</div>
            <div>전화번호: <a href="tel:${store.phone || '02-588-9258'}" style="color: #0284c7; font-weight: 700; text-decoration: none;">${store.phone || '02-588-9258'} (전화연결)</a></div>
            <div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #e2e8f0;">
              원산지 표기: ${blocks.legal_notices?.origin_or_license || '닭고기(국내산 100%)'}
            </div>
          </div>
        </div>
      `;
    } else if (activePwaMainTab === 'REVIEWS') {
      // 3. 고객 리뷰 탭
      mainTabContentHtml = `
        <div style="padding: 14px; background: #ffffff;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #f1f3f5;">
            <div>
              <span style="font-size: 20px; font-weight: 800; color: #ff9800;">★ 4.9</span>
              <span style="font-size: 13px; color: #8b95a1; margin-left: 4px;">(482개 평가)</span>
            </div>
            <span style="font-size: 11px; color: #1b8a5a; font-weight: 700; background: #eafbf3; padding: 2px 8px; border-radius: 4px;">클린리뷰 100%</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="border-bottom: 1px solid #f1f3f5; padding-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-weight: 700; font-size: 12.5px;">치킨*러버</span>
                <span style="color: #ff9800; font-size: 11px;">★★★★★</span>
              </div>
              <div style="font-size: 12px; color: #4e5968; line-height: 1.4; margin-bottom: 6px;">
                반반치킨 정석입니다. 후라이드는 바삭하고 양념은 너무 달지 않아서 좋아요. 치즈볼도 따뜻하게 왔습니다.
              </div>
              <div style="background: #f8fafc; border-left: 3px solid #2ac1bc; padding: 6px 10px; font-size: 11.5px; color: #334155;">
                <strong>사장님:</strong> 단골 예약이라니 너무 힘이 납니다 고객님! 늘 처음처럼 깨끗하고 맛있는 치킨으로 보답하겠습니다!
              </div>
            </div>

            <div style="border-bottom: 1px solid #f1f3f5; padding-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-weight: 700; font-size: 12.5px;">서초*미식가</span>
                <span style="color: #ff9800; font-size: 11px;">★★★★☆</span>
              </div>
              <div style="font-size: 12px; color: #4e5968; line-height: 1.4; margin-bottom: 6px;">
                대새레드치킨 랍스터새우 실하고 양념도 맛있게 매워요. 보통맛인데도 은근 매콤해서 맥주 안주로 최고입니다.
              </div>
            </div>
          </div>
        </div>
      `;
    }

    screen.innerHTML = `
      <!-- 사장님 실시간 공지 띠배너 -->
      <div id="pwa-live-notice-banner" style="display: ${blocks.notice ? 'block' : 'none'}; background: #fff8eb; color: #b45309; font-size: 11.5px; font-weight: 700; padding: 7px 12px; border-bottom: 1px solid #fef3c7; text-align: center;">
        ${blocks.notice || ''}
      </div>

      <!-- 상단 헤더 배너 -->
      <div class="mobile-header-banner" style="padding: 16px 14px 12px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <span style="font-size: 11px; background: rgba(0,0,0,0.25); padding: 3px 8px; border-radius: 12px; font-weight: 600; color: #ffffff;">고객 PWA 화면</span>
          <span class="tag" id="pwa-badge-parking" style="font-size: 10.5px; padding: 2px 8px; font-weight: 800; background: #dcfce7; color: #166534;">
            주차: ${blocks.parking?.capacity_text || '무료가능'}
          </span>
        </div>
        <h2 style="font-size: 19px; font-weight: 800; margin: 0 0 4px 0; color: #ffffff;">${store.store_name}</h2>
        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; margin-bottom: 10px; color: rgba(255,255,255,0.95);">
          <span style="color: #ffd54f; font-weight: 800;">★ 4.9</span>
          <span>(리뷰 482개)</span>
          <span>·</span>
          <span id="pwa-text-subway">${blocks.location_guide?.subway_station || '서초역 1번 출구'} 도보 ${blocks.location_guide?.walking_time_minutes || 3}분</span>
        </div>

        <!-- 서비스 3단 모드 전환 탭 -->
        <div style="display: flex; gap: 4px; background: rgba(0,0,0,0.2); padding: 3px; border-radius: 8px;">
          <button class="btn-pwa-mode ${activePwaMode === 'DELIVERY' ? 'active' : ''}" data-mode="DELIVERY" style="flex: 1; padding: 5px 0; font-size: 11.5px; font-weight: 700; border: none; border-radius: 6px; cursor: pointer; background: ${activePwaMode === 'DELIVERY' ? '#ffffff' : 'transparent'}; color: ${activePwaMode === 'DELIVERY' ? '#0f766e' : '#ffffff'};">
            배달
          </button>
          <button class="btn-pwa-mode ${activePwaMode === 'TAKEOUT' ? 'active' : ''}" data-mode="TAKEOUT" style="flex: 1; padding: 5px 0; font-size: 11.5px; font-weight: 700; border: none; border-radius: 6px; cursor: pointer; background: ${activePwaMode === 'TAKEOUT' ? '#ffffff' : 'transparent'}; color: ${activePwaMode === 'TAKEOUT' ? '#0f766e' : '#ffffff'};">
            포장 (픽업)
          </button>
          <button class="btn-pwa-mode ${activePwaMode === 'DINE_IN' ? 'active' : ''}" data-mode="DINE_IN" style="flex: 1.3; padding: 5px 0; font-size: 11.5px; font-weight: 800; border: none; border-radius: 6px; cursor: pointer; background: ${activePwaMode === 'DINE_IN' ? '#7c3aed' : 'transparent'}; color: #ffffff;">
            ★ 매장식사·예약
          </button>
        </div>
      </div>

      <!-- 탐색 3단 서브탭 (메뉴판 / 매장정보·위치·주차 / 리뷰) -->
      <div style="display: flex; border-bottom: 1px solid #e5e8eb; background: #ffffff;">
        <button class="pwa-sub-tab ${activePwaMainTab === 'MENU' ? 'active' : ''}" data-tab="MENU" style="flex: 1; padding: 10px 0; font-size: 12.5px; font-weight: 700; border: none; border-bottom: 2px solid ${activePwaMainTab === 'MENU' ? '#2ac1bc' : 'transparent'}; color: ${activePwaMainTab === 'MENU' ? '#191f28' : '#8b95a1'}; background: #ffffff; cursor: pointer;">
          메뉴판
        </button>
        <button class="pwa-sub-tab ${activePwaMainTab === 'INFO' ? 'active' : ''}" data-tab="INFO" style="flex: 1; padding: 10px 0; font-size: 12.5px; font-weight: 700; border: none; border-bottom: 2px solid ${activePwaMainTab === 'INFO' ? '#2ac1bc' : 'transparent'}; color: ${activePwaMainTab === 'INFO' ? '#191f28' : '#8b95a1'}; background: #ffffff; cursor: pointer;">
          정보 · 위치 · 주차
        </button>
        <button class="pwa-sub-tab ${activePwaMainTab === 'REVIEWS' ? 'active' : ''}" data-tab="REVIEWS" style="flex: 1; padding: 10px 0; font-size: 12.5px; font-weight: 700; border: none; border-bottom: 2px solid ${activePwaMainTab === 'REVIEWS' ? '#2ac1bc' : 'transparent'}; color: ${activePwaMainTab === 'REVIEWS' ? '#191f28' : '#8b95a1'}; background: #ffffff; cursor: pointer;">
          리뷰 (482)
        </button>
      </div>

      <!-- 메인 탭 콘텐츠 영역 -->
      ${mainTabContentHtml}

      <!-- 하단 고정 실시간 결제/예약 액션 바 -->
      <div style="position: sticky; bottom: 0; left: 0; right: 0; background: #ffffff; padding: 10px 14px; border-top: 1px solid #e5e8eb; box-shadow: 0 -2px 10px rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-size: 11px; color: #8b95a1;">선택: 대새레드치킨 외 1개</div>
          <div style="font-size: 15px; font-weight: 800; color: #191f28;">32,900원</div>
        </div>
        <button class="btn btn-primary" id="btn-pwa-submit-order" style="padding: 10px 18px; font-size: 13px; font-weight: 800; background: ${activePwaMode === 'DINE_IN' ? '#7c3aed' : '#2ac1bc'}; border-color: ${activePwaMode === 'DINE_IN' ? '#7c3aed' : '#2ac1bc'};">
          ${activePwaMode === 'DINE_IN' ? '테이블 예약 및 선주문하기' : (activePwaMode === 'TAKEOUT' ? '포장 주문하기' : '배달 주문하기')}
        </button>
      </div>
    `;

    // 이벤트 리스너 바인딩
    // 1) 배달/포장/홀예약 모드 변경
    screen.querySelectorAll('.btn-pwa-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        activePwaMode = btn.getAttribute('data-mode') || 'DELIVERY';
        renderPwaContent();
      });
    });

    // 2) 메뉴/정보/리뷰 탭 변경
    screen.querySelectorAll('.pwa-sub-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activePwaMainTab = btn.getAttribute('data-tab') || 'MENU';
        renderPwaContent();
      });
    });

    // 3) 카테고리 필터
    screen.querySelectorAll('.mobile-category-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        screen.querySelectorAll('.mobile-category-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const targetCatId = pill.getAttribute('data-pwa-cat');
        if (targetCatId === 'all') {
          screen.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          const sec = screen.querySelector(`#pwa-sec-${targetCatId}`);
          if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // 4) 실시간 예약/주문 제출 버튼 (점주 포털 KDS/테이블맵 실시간 전송)
    const btnSubmit = screen.querySelector('#btn-pwa-submit-order');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => {
        const timeVal = screen.querySelector('#pwa-select-res-time')?.value || '19:30';
        const guestVal = screen.querySelector('#pwa-select-guest-count')?.value || '4';
        alert(`[고객 PWA 실시간 주문/예약 접수 완료]\n\n모드: ${modeTag}\n예약시간: ${timeVal}\n방문인원: ${guestVal}명\n결제금액: 32,900원 (AITIP 제로페이)\n\n가맹점 포털의 [테이블 현황판]과 [실시간 KDS]에 즉시 전송되었습니다.`);
      });
    }
  };

  renderPwaContent();
}
