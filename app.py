from flask import Flask, request, jsonify, session, render_template, redirect, url_for
from datetime import datetime
import json
import os
from collections import OrderedDict

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'

INVENTORY_FILE = 'inventory.json'
LOG_FILE = 'log.txt'
RELOG_FILE = 'relog.txt'
STAFF_FILE = 'staff.json'

# 載入庫存
def load_inventory():
    if os.path.exists(INVENTORY_FILE):
        with open(INVENTORY_FILE, 'r', encoding='utf-8') as f:
            return json.load(f, object_pairs_hook=OrderedDict)
    return OrderedDict()

# 儲存庫存
def save_inventory(data):
    with open(INVENTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# 寫入 log.txt
def log_sale(name, identity, channel, order_id, total, items):
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(f"[{now}] 【銷售】{name} 身分:{identity} 通路:{channel} 單號:{order_id} 金額:${total}\n")
        for item in items:
            f.write(f" - {item['name']} {item['size']} x{item['qty']}\n")

# 載入員工資料
def load_staff():
    with open(STAFF_FILE, 'r') as f:
        return json.load(f)

@app.route('/')
def root_redirect():
    return redirect(url_for('login_page'))

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/home')
def home_page():
    if 'account' not in session:
        return redirect(url_for('login_page'))
    return render_template('home.html', name=session['name'])

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    account = data.get('account')
    password = data.get('password')
    staff = load_staff()
    if account in staff and staff[account]['password'] == password:
        session['account'] = account
        session['name'] = staff[account]['name']
        return jsonify({'status': 'success', 'name': staff[account]['name']})
    return jsonify({'status': 'fail', 'message': '帳號或密碼錯誤'})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'status': 'logged_out'})

@app.route('/api/check-login', methods=['GET'])
def check_login():
    if 'account' in session:
        return jsonify({'logged_in': True, 'account': session['account'], 'name': session['name']})
    return jsonify({'logged_in': False})

@app.route('/sale')
def sale_page():
    if 'account' not in session:
        return redirect(url_for('login_page'))
    return render_template('sale.html', name=session['name'])

@app.route('/manage')
def manage_page():
    if 'account' not in session:
        return redirect(url_for('login_page'))
    return render_template('manage.html')

@app.route('/log')
def log_page():
    if 'account' not in session:
        return redirect(url_for('login_page'))
    return render_template('log.html')

@app.route('/api/products', methods=['GET'])
def get_products():
    if 'account' not in session:
        return jsonify({'error': '未登入'}), 403
    inventory = load_inventory()
    return jsonify(inventory)

@app.route('/api/sale', methods=['POST'])
def sale():
    if 'name' not in session:
        return jsonify({'error': '未登入'}), 403

    data = request.json
    identity = data.get('identity')
    channel = data.get('channel')
    order_id = data.get('order_id')
    items = data.get('items', [])

    inventory = load_inventory()
    total = 0

    for item in items:
        name = item['name']
        size = item['size']
        qty = item['qty']

        if name not in inventory:
            return jsonify({'error': f'找不到商品：{name}'}), 400
        if size not in inventory[name]['styles']:
            return jsonify({'error': f'{name} 無此尺寸：{size}'}), 400
        if inventory[name]['styles'][size]['center'] < qty:
            return jsonify({'error': f'{name} {size} 庫存不足'}), 400

        inventory[name]['styles'][size]['center'] -= qty
        total += inventory[name]['price'] * qty

    if identity in ['校友會員', '在校生', '師長']:
        total = int(total * 0.9)

    save_inventory(inventory)
    log_sale(session['name'], identity, channel, order_id, total, items)
    return jsonify({'status': 'success', 'total': total})


@app.route('/api/gift', methods=['POST'])
def gift():
    if 'name' not in session:
        return jsonify({'error': '未登入'}), 403

    data = request.json
    giver = data.get('giver')
    items = data.get('items', [])

    inventory = load_inventory()

    for item in items:
        name = item['name']
        size = item['size']
        qty = item['qty']

        if name not in inventory:
            return jsonify({'error': f'找不到商品：{name}'}), 400
        if size not in inventory[name]['styles']:
            return jsonify({'error': f'{name} 無此尺寸：{size}'}), 400
        if inventory[name]['styles'][size]['center'] < qty:
            return jsonify({'error': f'{name} {size} 庫存不足'}), 400

        inventory[name]['styles'][size]['center'] -= qty

    def log_gift(name, giver, items):
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(f"[{now}] 【贈與】{name} 贈與人:{giver}\n")
            for item in items:
                f.write(f" - {item['name']} {item['size']} x{item['qty']}\n")


    save_inventory(inventory)
    log_gift(session['name'], giver, items)
    return jsonify({'status': 'success'})


@app.route('/api/return', methods=['POST'])
def return_goods():
    if 'name' not in session:
        return jsonify({'error': '未登入'}), 403

    data = request.json
    identity = data.get('identity')
    channel = data.get('channel')
    items = data.get('items', [])

    inventory = load_inventory()
    total = 0

    for item in items:
        name = item['name']
        size = item['size']
        qty = item['qty']

        if name not in inventory:
            return jsonify({'error': f'找不到商品：{name}'}), 400
        if size not in inventory[name]['styles']:
            return jsonify({'error': f'{name} 無此尺寸：{size}'}), 400

        inventory[name]['styles'][size]['center'] += qty
        total += inventory[name]['price'] * qty

    if identity in ['校友會員', '在校生', '師長']:
        total = int(total * 0.9)

    def log_return(name, identity, channel, total, items):
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        with open(RELOG_FILE, 'a', encoding='utf-8') as f:
            f.write(f"[{now}] 【退/換貨】{name} 身分:{identity} 通路:{channel} 退還金額：$-{total}\n")
            f.write("退回：\n")
            for item in items:
                f.write(f" - {item['name']} {item['size']} x-{item['qty']}\n")


    save_inventory(inventory)
    log_return(session['name'], identity, channel, total, items)
    return jsonify({'status': 'success', 'total': total})


@app.route('/api/relog-latest')
def relog_latest():
    if not os.path.exists(RELOG_FILE):
        return jsonify([])

    with open(RELOG_FILE, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    logs = []
    current = None
    for line in reversed(lines):
        if line.startswith('[') and '【退/換貨】' in line:
            if current:
                logs.append(current)
            time = line.split(']')[0][1:]
            current = {'time': time, 'items': []}
        elif line.startswith(' - ') and current is not None:
            parts = line.strip().split()
            name = parts[1]
            size = parts[2]
            qty = int(parts[3][2:])  # x-1 => 1
            current['items'].append({'name': name, 'size': size, 'qty': qty})
    if current:
        logs.append(current)

    return jsonify(logs[:2])

@app.route('/api/exchange', methods=['POST'])
def exchange():
    if 'name' not in session:
        return jsonify({'error': '未登入'}), 403

    data = request.json
    identity = data.get('identity')
    channel = data.get('channel')
    order_id = data.get('order_id')
    old_items = data.get('old_items', [])
    new_items = data.get('new_items', [])

    inventory = load_inventory()
    old_total = 0
    new_total = 0

    # 舊商品計算金額
    for item in old_items:
        name = item['name']
        size = item['size']
        qty = item['qty']
        if name not in inventory or size not in inventory[name]['styles']:
            return jsonify({'error': f'退回商品不存在：{name} {size}'}), 400
        old_total += inventory[name]['price'] * qty

    # 扣除新商品
    for item in new_items:
        name = item['name']
        size = item['size']
        qty = item['qty']
        if name not in inventory or size not in inventory[name]['styles']:
            return jsonify({'error': f'新商品不存在：{name} {size}'}), 400
        if inventory[name]['styles'][size]['center'] < qty:
            return jsonify({'error': f'{name} {size} 庫存不足'}), 400
        inventory[name]['styles'][size]['center'] -= qty
        new_total += inventory[name]['price'] * qty

    # 折扣
    if identity in ['校友會員', '在校生', '師長']:
        old_total = int(old_total * 0.9)
        new_total = int(new_total * 0.9)

    diff = new_total - old_total

    save_inventory(inventory)

    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(f"[{now}] 【換貨】{session['name']} 身分:{identity} 通路:{channel} 單號:{order_id} 差額：${diff}\n")
        f.write("退回：\n")
        for item in old_items:
            f.write(f" - {item['name']} {item['size']} x-{item['qty']}\n")
        f.write("換出：\n")
        for item in new_items:
            f.write(f" - {item['name']} {item['size']} x{item['qty']}\n")

    return jsonify({'status': 'success', 'diff': diff})




if __name__ == "__main__":
    app.run(debug=True, port=5050)
