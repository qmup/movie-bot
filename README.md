# Bot Telegram xem phim Nguonc

Bot nhận tên phim ngay trong chat, tìm trên [Nguonc](https://phim.nguonc.com), rồi gửi poster và các nút tập mở thẳng trình phát trong Telegram (Mini App).

## Cài đặt

Cần Node.js 18 trở lên.

```bash
npm install
```

## Tạo token

1. Mở Telegram và nhắn [@BotFather](https://t.me/BotFather).
2. Gửi `/newbot`, đặt tên và username cho bot.
3. BotFather trả về một token. Giữ token đó cho bước sau.

Nếu một token từng được commit trong một repo khác, hãy thu hồi token đó trong BotFather bằng `/revoke` rồi tạo token mới. Lịch sử git cũ vẫn còn token đã lộ, nên không được dùng lại.

## Cấu hình

```bash
cp .env.example .env
```

Mở `.env` và điền token mới sau dấu bằng:

```bash
BOT_TOKEN=
```

File `.env` không được commit.

### Vì sao không gửi thẳng link `embed.streamc.xyz`?

Cloudflare của streamc chặn request **không có header `Referer`**. Trên trang Nguonc, player nằm trong iframe nên có Referer và trả 200. Nút URL trên Telegram mở tab mới (không Referer) nên bị **403**.

Mặc định bot mở `https://phim.nguonc.com/phim/<slug>` thay vì embed thô. Muốn bấm tập là vào đúng tập, hãy host `public/watch.html` trên HTTPS (Content-Type `text/html`) rồi set `WATCH_BASE_URL` trong `.env`.

## Chạy

```bash
node index.js
```

Nếu thiếu `BOT_TOKEN`, tiến trình thoát và báo cách tạo file `.env`.

Mở chat với bot và gõ tên phim, kể cả tin nhắn đầu tiên. Không cần `/start`. Lệnh `/start` chỉ trả một câu nhắc ngắn.
