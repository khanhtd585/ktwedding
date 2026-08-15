# Hướng dẫn kết nối Google Login và Google Drive

Tài liệu này giúp cấu hình Google Login và Google Drive Picker cho Everafter khi chạy local.

## 1. Tạo Google Cloud project

**Vì sao cần bước này?** Google chỉ cấp OAuth credentials và quản lý API usage bên trong một Google Cloud project.

1. Mở [Google Cloud Console](https://console.cloud.google.com/).
2. Chọn **Select a project** → **New Project**.
3. Đặt tên, ví dụ: `everafter-local`.
4. Chọn **Create**.

## 2. Bật Google Drive API

**Vì sao cần bước này?** App dùng Drive API để đọc metadata, thumbnail và danh sách ảnh trong folder mà user chọn.

1. Vào **APIs & Services** → **Library**.
2. Tìm `Google Drive API`.
3. Mở kết quả và bấm **Enable**.

## 3. Cấu hình OAuth consent screen

**Vì sao cần bước này?** Đây là màn hình Google hiển thị cho user biết app là gì và app xin quyền đọc Drive nào trước khi họ đồng ý.

1. Vào **APIs & Services** → **OAuth consent screen**.
2. Chọn **External**.
3. Điền App name, User support email và Developer contact information.
4. Trong phần scopes, thêm:

   - `openid`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
   - `https://www.googleapis.com/auth/drive.readonly`

5. Ở **Test users**, thêm email Google sẽ dùng để test.

> Trong giai đoạn Testing, chỉ các email được thêm vào Test users mới đăng nhập được. Không chia sẻ client secret hoặc API key.

## 4. Tạo OAuth Client ID

**Vì sao cần bước này?** Client ID/secret xác định Everafter với Google; redirect URI giúp Google chỉ trả kết quả đăng nhập về đúng ứng dụng của bạn.

1. Vào **APIs & Services** → **Credentials**.
2. Chọn **Create Credentials** → **OAuth client ID**.
3. Chọn Application type: **Web application**.
4. Nhập tên, ví dụ `Everafter Local`.
5. Thêm Authorized JavaScript origins:

   ```text
   http://localhost:8000
   ```

6. Thêm Authorized redirect URIs:

   ```text
   http://localhost:8000/auth/google/callback
   ```

7. Bấm **Create** và lưu lại:

   - Client ID
   - Client secret

## 5. Tạo API key cho Google Picker

**Vì sao cần bước này?** Google Picker chạy trong trình duyệt để user chọn folder trực quan thay vì phải tự copy folder ID.

1. Vào **APIs & Services** → **Credentials**.
2. Chọn **Create Credentials** → **API key**.
3. Chọn API key vừa tạo → **Edit API key**.
4. Ở Application restrictions, chọn **Websites** và thêm:

   ```text
   http://localhost:8000/*
   ```

5. Ở API restrictions, chọn **Restrict key** và chọn Google Picker API nếu có trong danh sách.
6. Lưu API key.

## 6. Tạo secrets local

**Vì sao cần bước này?** `TOKEN_ENCRYPTION_KEY` mã hóa refresh token Google trong SQLite; `SESSION_SECRET` ký cookie đăng nhập để người khác không thể giả mạo session.

Mở PowerShell trong thư mục project:

```powershell
cd C:\Users\kdangtran\Documents\Codex\2026-08-14\s\outputs\everafter-mvp
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Lưu giá trị thứ nhất làm `TOKEN_ENCRYPTION_KEY`, giá trị thứ hai làm `SESSION_SECRET`.

## 7. Tạo file `.env`

**Vì sao cần bước này?** File `.env` đưa credentials vào runtime mà không hard-code hoặc commit các secrets vào source code.

Sao chép `.env.example` thành `.env`, rồi điền giá trị thật:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_PICKER_API_KEY=your-google-picker-api-key
GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback
TOKEN_ENCRYPTION_KEY=your-fernet-key
SESSION_SECRET=your-random-session-secret
DATABASE_PATH=./everafter-local.sqlite3
DEMO_MODE=false
COOKIE_SECURE=false
```

Không commit file `.env` lên Git hoặc gửi client secret/API key qua chat.

## 8. Chạy app local

**Vì sao cần bước này?** App cần chạy đúng port và đọc `.env` để callback URL đã khai báo trên Google Cloud khớp hoàn toàn.

```powershell
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --env-file .env
```

Mở đúng URL sau trong browser:

```text
http://localhost:8000
```

Không dùng `http://127.0.0.1:8000` cho luồng OAuth local, vì redirect URI đã đăng ký là `localhost`.

## 9. Kiểm tra

**Vì sao cần bước này?** Xác nhận đầy đủ chuỗi Google login → chọn folder → Drive import hoạt động trước khi deploy.

1. Bấm **Continue with Google**.
2. Chọn tài khoản đã thêm vào Test users.
3. Tạo project.
4. Bấm **Choose from Google Drive**.
5. Chọn folder ảnh cưới.
6. Xác nhận app hiển thị album `All photos` với ảnh trong folder.

## Khi deploy production

**Vì sao cần bước này?** Google OAuth production yêu cầu callback HTTPS ổn định để bảo vệ thông tin đăng nhập; public IP qua HTTP không đáp ứng yêu cầu này.

Dùng domain HTTPS, ví dụ `https://photos.example.com`, rồi thay cả Google Console và `.env` thành:

```text
https://photos.example.com/auth/google/callback
```

Public IP dùng HTTP không phù hợp cho Google OAuth production.
