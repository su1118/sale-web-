// ========================
// 全域變數與設定
// ========================
let products = {};   // 從 /api/products 取得的完整資料
let cart = [];       // 購物車項目
let allCategories = new Set();
let currentCategory = "全部分類";
let currentSearch = "";

const categoryColors = {
  "衣物": "#ff6b6b",
  "背包": "#4d96ff",
  "杯具": "#38b000",
  "配件": "#a149fa",
  "徽章磁鐵": "#ffa500",
  "預購": "#111111"
};

const sizeOrder = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];

// ========================
// 登入 / 登出
// ========================
async function login() {
  const account = document.getElementById('account').value;
  const password = document.getElementById('password').value;

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password })
  });

  const result = await res.json();
  if (result.status === 'success') {
    window.location.href = '/home';
  } else {
    document.getElementById('status').innerText = result.message;
  }
}

async function logout() {
  const res = await fetch('/api/logout', { method: 'POST' });
  const result = await res.json();
  if (result.status === 'logged_out') {
    window.location.href = '/login';
  }
}

// ========================
// 功能按鈕導頁 + 初始化
// ========================
document.addEventListener('DOMContentLoaded', async () => {
  const btns = document.querySelectorAll('.function-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.innerText;
      if (text === '販售') window.location.href = '/sale';
      else if (text === '管理') window.location.href = '/manage';
      else if (text === '紀錄') window.location.href = '/log';
    });
  });

  const nameSpan = document.getElementById('staff-name');
  if (nameSpan) {
    const res = await fetch('/api/check-login');
    const result = await res.json();
    if (result.logged_in) {
      nameSpan.innerText = result.name;
    }
  }

  const searchInput = document.getElementById('search-keyword');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentSearch = searchInput.value;
      renderProducts(products);
    });
  }

  const categorySelect = document.getElementById('category-select');
  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      currentCategory = categorySelect.value;
      renderProducts(products);
    });
  }

  if (document.getElementById('product-list')) {
    const res = await fetch('/api/products');
    products = await res.json();
    renderProducts(products);
  }
});

// ========================
// 商品區：渲染商品卡片
// ========================
function renderProducts(productList) {
  const list = document.getElementById('product-list');
  list.innerHTML = '';
  allCategories.clear();

  Object.keys(productList).forEach(key => {
    const p = productList[key];
    if (!p.styles || typeof p.styles !== 'object') return;

    const category = p.category || "其他";
    allCategories.add(category);

    if (currentCategory !== "全部分類" && currentCategory !== category) return;

    const keyword = currentSearch.trim().toLowerCase();
    if (keyword) {
      const matchInName = p.name.toLowerCase().includes(keyword);
      const matchInStyles = Object.keys(p.styles).some(size => size.toLowerCase().includes(keyword));
      if (!matchInName && !matchInStyles) return;
    }

    const keys = Object.keys(p.styles);
    const useStandard = keys.every(k => sizeOrder.includes(k));
    const sortedKeys = useStandard
      ? sizeOrder.filter(k => keys.includes(k))
      : keys;

    const styleText = sortedKeys
      .map(size => `${size}:${p.styles[size].center}`)
      .join('；');


    const color = categoryColors[category] || "#999";

    const div = document.createElement('div');
    div.className = 'product-card';
    div.style.borderLeft = `5px solid ${color}`;
    div.innerHTML = `
      <div>
        <b>${p.name}</b>　價格：${p.price}<br>${styleText}
      </div>
      <button class="green-btn" onclick='addToCart("${key}")'>＋</button>
    `;
    list.appendChild(div);
  });

  renderCategoryOptions();
}

function renderCategoryOptions() {
  const select = document.getElementById('category-select');
  if (!select) return;

  const current = select.value || "全部分類";
  select.innerHTML = `<option>全部分類</option>`;

  Array.from(allCategories).forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    if (cat === current) option.selected = true;
    select.appendChild(option);
  });
}

// ========================
// 購物車處理
// ========================
function addToCart(productKey) {
  const p = products[productKey];
  const availableSizes = Object.keys(p.styles).filter(s => p.styles[s].center > 0);
  const defaultSize = availableSizes[0] || null;

  cart.push({ key: productKey, size: defaultSize, qty: 1 });
  renderCart();
  updateTotal();
}

function renderCart() {
  const area = document.getElementById('cart-area');
  area.innerHTML = '';

  cart.forEach((item, index) => {
    const p = products[item.key];
    const keys = Object.keys(p.styles);
    const useStandard = keys.every(k => sizeOrder.includes(k));

    const sortedSizes = useStandard
      ? sizeOrder.filter(k => keys.includes(k))
      : keys;

    const sizeOptions = sortedSizes
      .map(size => {
        const stock = p.styles[size].center;
        const label = stock === 0 ? `${size}（無庫存）` : size;
        return `<option value="${size}" ${item.size === size ? 'selected' : ''}>${label}</option>`;
      })
      .join('');

    const selectedSize = item.size || sortedSizes[0];
    const maxQty = selectedSize ? p.styles[selectedSize].center : 1;

    const qtyOptions = Array.from({ length: maxQty }, (_, i) => i + 1)
      .map(q => `<option value="${q}" ${q === item.qty ? 'selected' : ''}>${q}</option>`)
      .join('');

    const styleText = sortedSizes
      .map(size => `${size}:${p.styles[size].center}`)
      .join('；');

    const div = document.createElement('div');
    div.className = 'cart-card';
    div.innerHTML = `
      <div>
        <b>${p.name}</b>　價格：${p.price}<br>${styleText}
      </div>
      <div>
        <select onchange="updateSize(${index}, this.value)">${sizeOptions}</select>
        <select onchange="updateQty(${index}, this.value)">${qtyOptions}</select>
        <button onclick="removeFromCart(${index})" style="background: #005fff; color: white; border:none;">刪除</button>
      </div>
    `;
    area.appendChild(div);
  });
}


function updateSize(index, size) {
  cart[index].size = size;
  cart[index].qty = 1;
  renderCart();
  updateTotal();
}

function updateQty(index, qty) {
  cart[index].qty = parseInt(qty);
  updateTotal();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
  updateTotal();
}

function updateTotal() {
  let total = 0;
  cart.forEach(item => {
    const p = products[item.key];
    total += p.price * item.qty;
  });
  document.getElementById('total-amount').innerText = total;
}


// ========================
// 銷售流程彈窗操作邏輯
// ========================
let saleData = {
  identity: '',
  channel: '',
  order_id: '',
  items: []
};

function openSaleStep1() {
  const html = `
    <h2>請選擇身分與通路</h2>
    <label>身分別：</label><br>
    <div>
      <label><input type="radio" name="identity" value="校友會員"> 校友會員</label>
      <label><input type="radio" name="identity" value="在校生"> 在校生</label>
      <label><input type="radio" name="identity" value="師長"> 師長</label>
      <label><input type="radio" name="identity" value="家長"> 家長</label>
      <label><input type="radio" name="identity" value="其他"> 其他</label>
    </div><br>
    <label>通路：</label>
    <select id="sale-channel">
      <option>店面</option>
      <option>網路</option>
    </select>
  `;
  Swal.fire({
    title: '銷售步驟 1',
    html,
    showCancelButton: true,
    confirmButtonText: '下一步',
    preConfirm: () => {
      const selected = document.querySelector('input[name="identity"]:checked');
      const identity = selected ? selected.value : '';
      const channel = document.getElementById('sale-channel').value;
      if (!identity) {
        Swal.showValidationMessage('請選擇身分別');
        return false;
      }
      saleData.identity = identity;
      saleData.channel = channel;
    }
  }).then(result => {
    if (result.isConfirmed) openSaleStep2();
  });
}

function openSaleStep2() {
  if (cart.length === 0) {
    Swal.fire('購物車為空', '請先加入商品', 'warning');
    return;
  }
  saleData.items = cart.map(item => ({
    name: products[item.key].name,
    size: item.size,
    qty: item.qty
  }));

  let html = '<ul style="text-align:left">';
  saleData.items.forEach(i => {
    html += `<li>${i.name} ${i.size} x${i.qty}</li>`;
  });
  html += '</ul>';

  Swal.fire({
    title: '銷售步驟 2',
    html: `<h2>確認商品清單</h2>${html}`,
    showCancelButton: true,
    confirmButtonText: '下一步'
  }).then(result => {
    if (result.isConfirmed) openSaleStep3();
  });
}

function openSaleStep3() {
  Swal.fire({
    title: '銷售步驟 3',
    input: 'text',
    inputLabel: '請輸入單號',
    inputPlaceholder: '例如：101',
    showCancelButton: true,
    confirmButtonText: '完成銷售',
    preConfirm: (value) => {
      if (!value) {
        Swal.showValidationMessage('單號不可為空');
        return false;
      }
      saleData.order_id = value;
    }
  }).then(result => {
    if (result.isConfirmed) submitSale();
  });
}

async function submitSale() {
  const res = await fetch('/api/sale', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saleData)
  });
  const result = await res.json();

  if (result.status === 'success') {
    Swal.fire('銷售完成', `總金額：$${result.total}`, 'success');
    cart = [];
    renderCart();
    updateTotal();

    // 重新取得最新庫存
    const res = await fetch('/api/products');
    products = await res.json();
    renderProducts(products);
  } else {
    Swal.fire('錯誤', result.error || '銷售失敗', 'error');
  }
}


// ========================
// 贈與流程彈窗操作邏輯
// ========================
let giftData = {
  giver: '',
  items: []
};

function openGiftStep1() {
  if (cart.length === 0) {
    Swal.fire('購物車為空', '請先加入商品', 'warning');
    return;
  }
  giftData.items = cart.map(item => ({
    name: products[item.key].name,
    size: item.size,
    qty: item.qty
  }));

  let html = '<ul style="text-align:left">';
  giftData.items.forEach(i => {
    html += `<li>${i.name} ${i.size} x${i.qty}</li>`;
  });
  html += '</ul>';

  Swal.fire({
    title: '贈與確認清單',
    html: `<h2>請確認以下商品</h2>${html}`,
    showCancelButton: true,
    confirmButtonText: '下一步'
  }).then(result => {
    if (result.isConfirmed) openGiftStep2();
  });
}

function openGiftStep2() {
  Swal.fire({
    title: '輸入贈與人姓名',
    input: 'text',
    inputLabel: '贈與人',
    inputPlaceholder: '例如：李大仁',
    showCancelButton: true,
    confirmButtonText: '完成贈與',
    preConfirm: (value) => {
      if (!value) {
        Swal.showValidationMessage('姓名不可為空');
        return false;
      }
      giftData.giver = value;
    }
  }).then(result => {
    if (result.isConfirmed) submitGift();
  });
}

async function submitGift() {
  const res = await fetch('/api/gift', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(giftData)
  });
  const result = await res.json();

  if (result.status === 'success') {
    Swal.fire('贈與完成', '資料已儲存並扣除庫存', 'success');
    cart = [];
    renderCart();
    updateTotal();

    // 重新載入商品清單
    const res2 = await fetch('/api/products');
    products = await res2.json();
    renderProducts(products);
  } else {
    Swal.fire('錯誤', result.error || '贈與失敗', 'error');
  }
}



// ========================
// 退貨流程彈窗操作邏輯
// ========================
let returnData = {
  identity: '',
  channel: '',
  items: []
};

function openReturnStep1() {
  if (cart.length === 0) {
    Swal.fire('購物車為空', '請先加入商品', 'warning');
    return;
  }

  const html = `
    <h2>請選擇身分與通路</h2>
    <label>身分別：</label><br>
    <div>
      <label><input type="radio" name="return-identity" value="校友會員"> 校友會員</label>
      <label><input type="radio" name="return-identity" value="在校生"> 在校生</label>
      <label><input type="radio" name="return-identity" value="師長"> 師長</label>
      <label><input type="radio" name="return-identity" value="家長"> 家長</label>
      <label><input type="radio" name="return-identity" value="其他"> 其他</label>
    </div><br>
    <label>通路：</label>
    <select id="return-channel">
      <option>店面</option>
      <option>網路</option>
    </select>
  `;

  Swal.fire({
    title: '退貨步驟 1',
    html,
    showCancelButton: true,
    confirmButtonText: '下一步',
    preConfirm: () => {
      const selected = document.querySelector('input[name="return-identity"]:checked');
      const identity = selected ? selected.value : '';
      const channel = document.getElementById('return-channel').value;
      if (!identity) {
        Swal.showValidationMessage('請選擇身分別');
        return false;
      }
      returnData.identity = identity;
      returnData.channel = channel;
    }
  }).then(result => {
    if (result.isConfirmed) openReturnStep2();
  });
}

function openReturnStep2() {
  returnData.items = cart.map(item => ({
    name: products[item.key].name,
    size: item.size,
    qty: item.qty
  }));

  let html = '<ul style="text-align:left">';
  returnData.items.forEach(i => {
    html += `<li>${i.name} ${i.size} x${i.qty}</li>`;
  });
  html += '</ul>';

  Swal.fire({
    title: '退貨確認清單',
    html: `<h2>請確認以下商品</h2>${html}`,
    showCancelButton: true,
    confirmButtonText: '完成退貨'
  }).then(result => {
    if (result.isConfirmed) submitReturn();
  });
}

async function submitReturn() {
  const res = await fetch('/api/return', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(returnData)
  });
  const result = await res.json();

  if (result.status === 'success') {
    Swal.fire('退貨完成', `退還金額：$${result.total}`, 'success');
    cart = [];
    renderCart();
    updateTotal();

    const res2 = await fetch('/api/products');
    products = await res2.json();
    renderProducts(products);
  } else {
    Swal.fire('錯誤', result.error || '退貨失敗', 'error');
  }
}



// ========================
// 換貨流程彈窗操作邏輯
// ========================
let exchangeData = {
  identity: '',
  channel: '',
  order_id: '',
  old_items: [],
  new_items: []
};

function openExchangeStep1() {
  const html = `
    <h2>請選擇身分與通路</h2>
    <label>身分別：</label><br>
    <div>
      <label><input type="radio" name="ex-identity" value="校友會員"> 校友會員</label>
      <label><input type="radio" name="ex-identity" value="在校生"> 在校生</label>
      <label><input type="radio" name="ex-identity" value="師長"> 師長</label>
      <label><input type="radio" name="ex-identity" value="家長"> 家長</label>
      <label><input type="radio" name="ex-identity" value="其他"> 其他</label>
    </div><br>
    <label>通路：</label>
    <select id="ex-channel">
      <option>店面</option>
      <option>網路</option>
    </select>
  `;

  Swal.fire({
    title: '換貨步驟 1',
    html,
    showCancelButton: true,
    confirmButtonText: '下一步',
    preConfirm: () => {
      const selected = document.querySelector('input[name="ex-identity"]:checked');
      const identity = selected ? selected.value : '';
      const channel = document.getElementById('ex-channel').value;
      if (!identity) {
        Swal.showValidationMessage('請選擇身分別');
        return false;
      }
      exchangeData.identity = identity;
      exchangeData.channel = channel;
      return true; 
    }
  }).then(result => {
    if (result.isConfirmed) openExchangeStep2();
  });
}

async function openExchangeStep2() {
  const res = await fetch('/api/relog-latest');
  const logs = await res.json();

  let html = '<h3>選擇要換貨的退貨紀錄：</h3><ul style="text-align:left">';
  logs.forEach((log, idx) => {
    const itemList = log.items.map(i => `${i.name} ${i.size} x${i.qty}`).join('<br>');
    html += `<li><input type="radio" name="old-log" value="${idx}"> [${log.time}]<br>${itemList}</li><br>`;
  });
  html += '</ul>';

  Swal.fire({
    title: '換貨步驟 2',
    html,
    showCancelButton: true,
    confirmButtonText: '下一步',
    preConfirm: () => {
      const selected = document.querySelector('input[name="old-log"]:checked');
      if (!selected) {
        Swal.showValidationMessage('請選擇一筆退貨紀錄');
        return false;
      }
      const index = parseInt(selected.value);
      exchangeData.old_items = logs[index].items;
    }
  }).then(result => {
    if (result.isConfirmed) openExchangeStep3();
  });
}

function openExchangeStep3() {
  exchangeData.new_items = cart.map(item => ({
    name: products[item.key].name,
    size: item.size,
    qty: item.qty
  }));

  if (exchangeData.new_items.length === 0) {
    Swal.fire('購物車為空', '請先加入新商品', 'warning');
    return;
  }

  const newList = exchangeData.new_items.map(i => `${i.name} ${i.size} x${i.qty}`).join('<br>');
  const oldList = exchangeData.old_items.map(i => `${i.name} ${i.size} x${i.qty}`).join('<br>');

  let oldTotal = 0;
  let newTotal = 0;

  exchangeData.old_items.forEach(i => {
    const price = Object.values(products).find(p => p.name === i.name)?.price || 0;
    oldTotal += price * i.qty;
  });

  exchangeData.new_items.forEach(i => {
    const price = Object.values(products).find(p => p.name === i.name)?.price || 0;
    newTotal += price * i.qty;
  });

  // 身分折扣
  const isDiscounted = ['校友會員', '在校生', '師長'].includes(exchangeData.identity);
  if (isDiscounted) {
    oldTotal = Math.floor(oldTotal * 0.9);
    newTotal = Math.floor(newTotal * 0.9);
  }

  const diff = newTotal - oldTotal;

  Swal.fire({
    title: '換貨步驟 3',
    html: `
      <h3>退回商品：</h3>${oldList}<br>
      <h3>換出商品：</h3>${newList}<br>
      <h3>差額：$${diff}</h3>
    `,
    showCancelButton: true,
    confirmButtonText: '下一步'
  }).then(result => {
    if (result.isConfirmed) openExchangeStep4();
  });
}

function openExchangeStep4() {
  exchangeData.new_items = cart.map(item => ({
    name: products[item.key].name,
    size: item.size,
    qty: item.qty
  }));

  Swal.fire({
    title: '輸入單號',
    input: 'text',
    inputLabel: '單號',
    showCancelButton: true,
    confirmButtonText: '完成換貨',
    preConfirm: (value) => {
      if (!value) {
        Swal.showValidationMessage('單號不可為空');
        return false;
      }
      exchangeData.order_id = value;
    }
  }).then(result => {
    if (result.isConfirmed) submitExchange();
  });
}

async function submitExchange() {
  const res = await fetch('/api/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(exchangeData)
  });
  const result = await res.json();

  if (result.status === 'success') {
    Swal.fire('換貨完成', `差額：$${result.diff}`, 'success');
    cart = [];
    renderCart();
    updateTotal();

    const res2 = await fetch('/api/products');
    products = await res2.json();
    renderProducts(products);
  } else {
    Swal.fire('錯誤', result.error || '換貨失敗', 'error');
  }
}