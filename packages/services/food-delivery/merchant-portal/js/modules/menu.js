/**
 * ============================================================================
 * AITIP Merchant Portal - 메뉴판 통합 관리 및 옵션 그룹 모듈 (ESM)
 * 준수 규격: DOC-08 (메뉴-옵션 3계층 트리, N-out-of-M 제약조건, PWA 프리뷰)
 * ============================================================================
 */
import { merchantApi } from '../api.js';
import { parseBulkCatalogInput } from '/core/merchant-meta/bulk-catalog-parser.mjs';

export function renderMenuCategoryFilterBar(state) {
  const tabsEl = document.getElementById('menu-category-tabs');
  const searchEl = document.getElementById('menu-search-input');
  if (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = 'true';
    searchEl.addEventListener('input', (e) => {
      state.menuSearchKeyword = (e.target.value || '').trim().toLowerCase();
      renderMenuGroupBlocks(state);
    });
  }
  if (!tabsEl) return;

  const activeCatId = state.selectedMenuCategoryId || 'ALL';
  const totalCount = state.products.length;
  const allBtn = `<button type="button" class="btn ${activeCatId === 'ALL' ? 'btn-primary' : 'btn-secondary'} btn-sm" data-filter-cat="ALL">전체 보기 (${totalCount})</button>`;
  const catBtns = state.categories.map(cat => {
    const cnt = state.products.filter(p => p.category_id === cat.id).length;
    const isActive = activeCatId === cat.id;
    return `<button type="button" class="btn ${isActive ? 'btn-primary' : 'btn-secondary'} btn-sm" data-filter-cat="${cat.id}">${cat.name} (${cnt})</button>`;
  }).join('');

  tabsEl.innerHTML = allBtn + catBtns;
  tabsEl.querySelectorAll('button[data-filter-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedMenuCategoryId = btn.getAttribute('data-filter-cat');
      renderMenuGroupBlocks(state);
    });
  });
}

export function renderMenuGroupBlocks(state) {
  renderMenuCategoryFilterBar(state);
  const container = document.getElementById('menu-group-blocks-container');
  if (!container) return;

  container.innerHTML = '';

  const activeCatId = state.selectedMenuCategoryId || 'ALL';
  const keyword = state.menuSearchKeyword || '';
  const visibleCategories = activeCatId === 'ALL'
    ? state.categories
    : state.categories.filter(cat => cat.id === activeCatId);

  visibleCategories.forEach((cat, idx) => {
    const block = document.createElement('div');
    block.className = 'menu-group-block';

    const catProducts = state.products.filter(p => {
      if (p.category_id !== cat.id) return false;
      if (!keyword) return true;
      return (p.name || '').toLowerCase().includes(keyword) || (p.description || '').toLowerCase().includes(keyword);
    });

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
                      ${(p.discounted_price || p.discount_price) ? `<span class="tag tag-neutral" style="color: #f04452; font-weight: 700;">할인중</span>` : ''}
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
        delProdBtn.addEventListener('click', () => deleteMenuWithConfirm(p.product_id, state));
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
    const res = await merchantApi.updateMenuItem(p.product_id, {
      name: newName,
      category_id: newCat,
      subcategory: newSubcat,
      channel: newChannel,
      price: newPrice,
      discounted_price: newDiscount,
      description: newDesc,
      status: newStatus,
      image_url: newImgUrl || p.image_url,
      schedule: p.schedule
    });
    if (res && res.product) {
      Object.assign(p, res.product);
    }
  } catch (err) {
    alert('메뉴 수정 저장 실패: ' + err.message);
    return;
  }

  document.getElementById('modal-edit-menu').classList.remove('show');
  renderMenuGroupBlocks(state);
}

export async function deleteMenuWithConfirm(productId, state, closeModal = false) {
  const p = state.products.find(item => item.product_id === productId);
  if (!p) return;

  if (!confirm(`'${p.name}' 메뉴를 메뉴판에서 완전히 삭제하시겠습니까?`)) return;
  try {
    await merchantApi.deleteMenuItem(productId);
    state.products = state.products.filter(item => item.product_id !== productId);
    if (closeModal) {
      document.getElementById('modal-edit-menu')?.classList.remove('show');
    }
    renderMenuGroupBlocks(state);
  } catch (err) {
    alert('메뉴 삭제 실패: ' + err.message);
  }
}

export function handleDeleteMenuFromModal(state) {
  const productId = document.getElementById('edit-menu-id').value;
  return deleteMenuWithConfirm(productId, state, true);
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
  const discountVal = document.getElementById('menu-input-discount')?.value.trim();
  const discountedPrice = discountVal ? Number(discountVal) : null;
  const catId = document.getElementById('menu-input-category').value;
  const subCat = document.getElementById('menu-input-subcategory').value;
  const channel = document.getElementById('menu-input-channel').value;

  const optionGroupIds = [];
  if (document.getElementById('check-opt-part')?.checked) optionGroupIds.push('optgrp_01h7x8part');
  if (document.getElementById('check-opt-sauce')?.checked) optionGroupIds.push('optgrp_01h7x8sauce');

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
    let imageUrl = '';
    const previewImg = document.getElementById('image-preview');
    const pendingDataUrl = previewImg?.dataset?.pendingDataUrl;
    if (pendingDataUrl) {
      const uploadRes = await merchantApi.uploadMenuImage({
        fileName: previewImg.dataset.pendingFileName || 'menu.png',
        dataUrl: pendingDataUrl
      });
      if (uploadRes && uploadRes.image_url) {
        imageUrl = uploadRes.image_url;
      }
    }

    const res = await merchantApi.createMenuItem({
      name,
      description: desc,
      price: Number(price),
      discounted_price: discountedPrice,
      category_id: catId,
      subcategory: subCat,
      channel,
      image_url: imageUrl,
      schedule,
      option_group_ids: optionGroupIds
    });

    state.products.push(res.product);
    renderMenuGroupBlocks(state);

    document.getElementById('menu-input-name').value = '';
    document.getElementById('menu-input-desc').value = '';
    document.getElementById('menu-input-price').value = '';
    if (document.getElementById('menu-input-discount')) document.getElementById('menu-input-discount').value = '';
    if (document.getElementById('menu-file-input')) document.getElementById('menu-file-input').value = '';
    if (previewImg) {
      previewImg.src = '';
      delete previewImg.dataset.pendingDataUrl;
      delete previewImg.dataset.pendingFileName;
      previewImg.classList.remove('show');
    }
    const placeholder = document.getElementById('image-placeholder');
    if (placeholder) placeholder.style.display = '';
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

// 4. 가맹점 포털 내 고객 PWA 실시간 미리보기 (실제 PWA 앱 직접 임베딩)
export function renderPwaSimulator(state) {
  const screen = document.getElementById('pwa-simulator-screen');
  if (!screen) return;

  const iframe = screen.querySelector('#pwa-simulator-iframe');
  if (iframe && iframe.contentWindow) {
    try {
      iframe.contentWindow.location.reload();
    } catch (_) {
      iframe.src = './pwa/';
    }
  } else {
    screen.innerHTML = `
      <iframe id="pwa-simulator-iframe" src="./pwa/" style="width: 100%; height: 100%; border: none; background: #ffffff; display: block;" title="AITIP 고객 주문 PWA 실시간 미리보기"></iframe>
    `;
  }
}

export function setupBulkImportModal(state) {
  const openBtn = document.getElementById('btn-open-bulk-import');
  const modal = document.getElementById('modal-bulk-import-menu');
  const fileInput = document.getElementById('bulk-csv-file');
  const sampleBtn = document.getElementById('btn-bulk-sample');
  const textarea = document.getElementById('bulk-raw-textarea');
  const parseBtn = document.getElementById('btn-bulk-parse');
  const summaryEl = document.getElementById('bulk-preview-summary');
  const tbody = document.getElementById('tbody-bulk-preview');
  const submitBtn = document.getElementById('btn-bulk-submit');

  if (!openBtn || !modal) return;

  let parsedItems = [];

  const renderPreview = () => {
    const defaultCat = (state.selectedMenuCategoryId && state.selectedMenuCategoryId !== 'ALL')
      ? (state.categories.find(c => c.id === state.selectedMenuCategoryId)?.name || '대표메뉴')
      : (state.categories[0]?.name || '대표메뉴');

    const res = parseBulkCatalogInput(textarea.value, defaultCat);
    parsedItems = res.items;

    if (summaryEl) {
      summaryEl.textContent = `총 ${res.summary.total}건 분석 완료 (등록 가능 ${res.summary.validCount}건 / 오류 ${res.summary.invalidCount}건)`;
    }
    if (submitBtn) {
      submitBtn.disabled = res.summary.validCount === 0;
    }
    if (!tbody) return;

    if (parsedItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 18px;">분석된 항목이 없습니다.</td></tr>';
      return;
    }

    tbody.innerHTML = parsedItems.map((it, idx) => `
      <tr style="${it.valid ? '' : 'background: #fef2f2; color: #b91c1c;'}">
        <td style="text-align: center;"><input type="checkbox" class="bulk-item-check" data-idx="${idx}" ${it.valid ? 'checked' : 'disabled'}></td>
        <td>${it.category_name}</td>
        <td><strong>${it.name || '-'}</strong></td>
        <td style="text-align: right;">${Number(it.price || 0).toLocaleString()}원</td>
        <td style="text-align: right;">${it.discounted_price !== null ? `${Number(it.discounted_price).toLocaleString()}원` : '-'}</td>
        <td>${it.valid ? (it.description || '<span style="color:#059669;">정상</span>') : `오류: ${it.error}`}</td>
      </tr>
    `).join('');
  };

  openBtn.addEventListener('click', () => {
    modal.classList.add('show');
  });

  if (sampleBtn && textarea) {
    sampleBtn.addEventListener('click', () => {
      textarea.value = [
        '[메인 치킨 (대표메뉴)] 통마늘간장치킨 20,900원 알싸한 마늘 간장 풍미',
        '사이드 & 안주 | 바삭 어니언링 | 6500 | 5500 | 수제 타르타르 소스 포함',
        '음료 & 주류 | 제로콜라 1.25L | 3000'
      ].join('\n');
      renderPreview();
    });
  }

  if (fileInput && textarea) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        textarea.value = String(ev.target?.result || '');
        renderPreview();
      };
      reader.readAsText(file, 'UTF-8');
    });
  }

  if (parseBtn) parseBtn.addEventListener('click', renderPreview);

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const checkedIndices = Array.from(modal.querySelectorAll('.bulk-item-check:checked'))
        .map(el => Number(el.getAttribute('data-idx')));
      const selected = checkedIndices.map(i => parsedItems[i]).filter(it => it && it.valid);
      if (selected.length === 0) {
        alert('등록할 유효한 메뉴를 선택해 주세요.');
        return;
      }
      try {
        const res = await merchantApi.bulkCreateMenuItems(selected);
        if (Array.isArray(res.created_categories)) {
          state.categories.push(...res.created_categories);
        }
        if (Array.isArray(res.products)) {
          state.products.push(...res.products);
        }
        renderCategoryDropdowns(state);
        renderMenuGroupBlocks(state);
        textarea.value = '';
        parsedItems = [];
        if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 18px;">분석된 항목이 여기에 표시됩니다.</td></tr>';
        if (summaryEl) summaryEl.textContent = '텍스트 입력 후 [미리보기 분석]을 눌러주세요.';
        submitBtn.disabled = true;
        modal.classList.remove('show');
        alert(`${res.created_count}개의 메뉴가 성공적으로 일괄 등록되었습니다.`);
      } catch (err) {
        alert('일괄 등록 실패: ' + err.message);
      }
    });
  }
}
