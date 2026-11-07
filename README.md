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

`node index.js` dùng long polling, chỉ để chạy thử trên máy. Bản chính chạy trên Vercel.

## Chạy trên Vercel (webhook)

Telegram gửi từng update tới `api/telegram.js`. Phiên tìm kiếm (2 giờ) nằm trong Vercel Runtime Cache để nút bấm vẫn dùng được khi request rơi vào instance khác.

1. Trên project Vercel, đặt `BOT_TOKEN`, `WATCH_BASE_URL` và `TELEGRAM_WEBHOOK_SECRET` (chuỗi ngẫu nhiên, ví dụ `openssl rand -hex 32`).
2. Deploy: `vercel deploy --prod`.
3. Đăng ký webhook với cùng các giá trị đó trong `.env`:

```bash
npm run set-webhook -- https://movie-bot-five-sigma.vercel.app
```

Request không có header `X-Telegram-Bot-Api-Secret-Token` đúng bị trả 401. Khi đã đặt webhook, Telegram từ chối long polling, nên đừng chạy `node index.js` với cùng token.

## Bot Zalo

Cùng project Vercel, Zalo gửi tin tới `api/zalo.js`. Zalo Bot chưa có nút bấm dưới tin nhắn, nên người dùng trả lời bằng chữ:

| Gõ | Bot trả lời |
| --- | --- |
| Tên phim | Danh sách có số thứ tự |
| `2` | Poster, chi tiết phim số 2 và số tập |
| `1180` hoặc `tập 1180` | Link xem tập 1180 |
| `mới` | Link tập mới nhất |
| `tiếp` / `trước` / `trang 3` | Đổi trang kết quả |
| `ds` | Xem lại danh sách |
| `server 2` | Đổi server |
| `tìm 1917` | Tìm phim có tên là số |

Bot chỉ trả lời chat riêng, bỏ qua tin trong nhóm.

1. Tạo bot qua OA **Zalo Bot Manager** → **Tạo bot** (tên phải bắt đầu bằng "Bot"). Zalo gửi Bot Token qua tin nhắn.
2. Trên project Vercel, đặt `ZALO_BOT_TOKEN` và `ZALO_WEBHOOK_SECRET` (8–256 ký tự, ví dụ `openssl rand -hex 32`), rồi deploy.
3. Đăng ký webhook với cùng các giá trị đó trong `.env`:

```bash
npm run set-zalo-webhook -- https://movie-bot-five-sigma.vercel.app
```

Zalo gửi thử một request ngay khi đăng ký và script in ra kết quả. Request không có header `X-Bot-Api-Secret-Token` đúng bị trả 401.
