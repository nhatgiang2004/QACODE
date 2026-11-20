/***********************************************************************
 * HỆ THỐNG QUẢN LÝ QUÁN CAFE – GIAI ĐOẠN 1
 * Danh mục · Bán hàng · Hóa đơn · Thanh toán
 * (Tài khoản, phiên đăng nhập, quản trị: xem QuanTri.gs; khách gọi món bằng QR: GoiMon.gs)
 * Nền tảng: Google Sheets + Apps Script Web App (nhiều chi nhánh)
 *
 * Quy ước:
 *  - Tên bảng/cột: tiếng Việt không dấu, viết hoa, gạch dưới.
 *  - Giá trị hiển thị (trạng thái, vai trò...): tiếng Việt có dấu.
 *  - Các bảng liên kết bằng MÃ, không liên kết bằng tên.
 *  - Không xóa dữ liệu giao dịch: dùng trạng thái "Đã hủy" + lịch sử.
 *  - Hàm kết thúc bằng "_" là hàm nội bộ, Web App không gọi được.
 ***********************************************************************/

const MUI_GIO = 'Asia/Ho_Chi_Minh';
const PHIEN_BAN_UNG_DUNG = '2026.11.20-21'; // phải trùng với PHIEN_BAN_GIAO_DIEN trong Index.html
const THOI_HAN_PHIEN = 21600; // giây (6 giờ – tối đa của CacheService)

/* ============================ HẰNG SỐ ============================ */

const TT = {
  DANG_BAN: 'Đang bán', NGUNG_BAN: 'Ngừng bán',
  HOAT_DONG: 'Hoạt động', NGUNG: 'Ngừng hoạt động',
  DANG_LAM: 'Đang làm', NGHI_VIEC: 'Nghỉ việc',
  HD_DANG_PHUC_VU: 'Đang phục vụ', HD_DA_THANH_TOAN: 'Đã thanh toán', HD_DA_HUY: 'Đã hủy',
  CT_HOAT_DONG: 'Hoạt động', CT_DA_HUY: 'Đã hủy',
  PC_CHO: 'Chờ pha chế', PC_XONG: 'Đã xong'
};

const LOAI_DON = { TAI_BAN: 'Tại bàn', MANG_DI: 'Mang đi' };
const LOAI_GIAM = { PHAN_TRAM: 'Phần trăm', SO_TIEN: 'Số tiền' };

const VT = {
  CHU_QUAN: 'Chủ quán', QUAN_LY: 'Quản lý', THU_NGAN: 'Thu ngân',
  PHA_CHE: 'Pha chế', PHUC_VU: 'Phục vụ'
};

const NHOM_QUYEN = {
  BAN_HANG: [VT.CHU_QUAN, VT.QUAN_LY, VT.THU_NGAN, VT.PHUC_VU],
  THANH_TOAN: [VT.CHU_QUAN, VT.QUAN_LY, VT.THU_NGAN],
  HUY_MON_DA_PHA: [VT.CHU_QUAN, VT.QUAN_LY, VT.THU_NGAN],
  HUY_HOA_DON: [VT.CHU_QUAN, VT.QUAN_LY],
  PHA_CHE: [VT.CHU_QUAN, VT.QUAN_LY, VT.THU_NGAN, VT.PHA_CHE, VT.PHUC_VU],
  XEM_HOA_DON: [VT.CHU_QUAN, VT.QUAN_LY, VT.THU_NGAN],
  XEM_GIA_VON: [VT.CHU_QUAN, VT.QUAN_LY],
  QUAN_TRI: [VT.CHU_QUAN, VT.QUAN_LY]
};

/* ======================= CẤU TRÚC CÁC BẢNG ======================= */

const CAU_TRUC = {
  // Nhóm A – Danh mục
  DM_CHINHANH: ['MA_CHI_NHANH', 'TEN_CHI_NHANH', 'DIA_CHI', 'SO_DIEN_THOAI', 'TRANG_THAI'],
  DM_DONVITINH: ['MA_DON_VI_TINH', 'TEN_DON_VI_TINH'],
  DM_NHOMSANPHAM: ['MA_NHOM_SAN_PHAM', 'TEN_NHOM_SAN_PHAM', 'THU_TU', 'TRANG_THAI'],
  DM_SANPHAM: ['MA_SAN_PHAM', 'TEN_SAN_PHAM', 'MA_NHOM_SAN_PHAM', 'DON_VI_TINH', 'GIA_BAN', 'GIA_VON',
    'HINH_ANH', 'THU_TU', 'TRANG_THAI', 'GHI_CHU'],
  DM_KHUVUC: ['MA_KHU_VUC', 'MA_CHI_NHANH', 'TEN_KHU_VUC', 'THU_TU', 'TRANG_THAI'],
  DM_BAN: ['MA_BAN', 'MA_CHI_NHANH', 'MA_KHU_VUC', 'TEN_BAN', 'SO_CHO', 'THU_TU', 'TRANG_THAI'],
  DM_NHANVIEN: ['MA_NHAN_VIEN', 'TEN_NHAN_VIEN', 'MA_CHI_NHANH', 'VAI_TRO', 'SO_DIEN_THOAI', 'NGAY_VAO_LAM',
    'TRANG_THAI', 'GHI_CHU'],
  DM_KHACHHANG: ['MA_KHACH_HANG', 'TEN_KHACH_HANG', 'SO_DIEN_THOAI', 'NGAY_TAO', 'NGUOI_TAO', 'GHI_CHU'],
  DM_PHUONGTHUCTHANHTOAN: ['MA_PHUONG_THUC', 'TEN_PHUONG_THUC', 'THU_TU', 'TRANG_THAI'],
  // Nhóm B – Bán hàng
  BH_GIAMGIA: ['MA_GIAM_GIA', 'TEN_CHUONG_TRINH', 'LOAI_GIAM', 'GIA_TRI', 'MA_CHI_NHANH',
    'NGAY_BAT_DAU', 'NGAY_KET_THUC', 'TRANG_THAI'],
  BH_HOADON: ['MA_HOA_DON', 'MA_CHI_NHANH', 'NGAY_BAN', 'GIO_BAN', 'LOAI_DON', 'MA_BAN', 'MA_NHAN_VIEN',
    'MA_KHACH_HANG', 'TONG_TIEN_HANG', 'MA_GIAM_GIA', 'LOAI_GIAM', 'GIA_TRI_GIAM', 'TIEN_GIAM_GIA',
    'TONG_THANH_TOAN', 'DA_THANH_TOAN', 'TONG_GIA_VON', 'TRANG_THAI', 'NGAY_TAO', 'NGUOI_TAO',
    'NGAY_CAP_NHAT', 'GHI_CHU'],
  BH_CHITIETHOADON: ['MA_CHI_TIET', 'MA_HOA_DON', 'MA_SAN_PHAM', 'TEN_SAN_PHAM', 'SO_LUONG', 'DON_GIA',
    'GIA_VON', 'GIAM_GIA', 'THANH_TIEN', 'TRANG_THAI_PHA_CHE', 'TRANG_THAI', 'NGAY_TAO', 'NGUOI_TAO', 'GHI_CHU'],
  BH_THANHTOAN: ['MA_THANH_TOAN', 'MA_HOA_DON', 'MA_CHI_NHANH', 'NGAY_THANH_TOAN', 'MA_PHUONG_THUC',
    'SO_TIEN', 'TIEN_KHACH_DUA', 'TIEN_THOI_LAI', 'NGUOI_THU', 'GHI_CHU'],
  BH_YEUCAU: ['MA_YEU_CAU', 'MA_CHI_NHANH', 'MA_BAN', 'LOAI', 'NOI_DUNG', 'GHI_CHU', 'TEN_KHACH', 'TRANG_THAI', 'THOI_GIAN',
    'NGUOI_XU_LY', 'THOI_GIAN_XU_LY', 'MA_HOA_DON', 'LY_DO'],
  BH_LICHSUHANG: ['MA_LICH_SU', 'MA_HOA_DON', 'THOI_GIAN', 'LOAI_THAO_TAC', 'NOI_DUNG', 'NGUOI_THUC_HIEN'],
  // Nhóm E – Nhân sự (tài khoản đăng nhập)
  NS_TAIKHOAN: ['MA_TAI_KHOAN', 'TEN_DANG_NHAP', 'MA_NHAN_VIEN', 'MAT_KHAU', 'MUOI', 'DOI_MAT_KHAU', 'PHIEN_BAN',
    'TRANG_THAI', 'LAN_DANG_NHAP_CUOI', 'NGAY_TAO', 'NGUOI_TAO', 'GHI_CHU'],
  // Hệ thống
  HT_THONGTINQUAN: ['KHOA', 'TEN_TRUONG', 'NOI_DUNG'],
  HT_BODEM: ['KHOA', 'GIA_TRI']
};

const COT_VAN_BAN = ['SO_DIEN_THOAI', 'MA_PIN', 'GIO_BAN', 'TEN_DANG_NHAP', 'MAT_KHAU', 'MUOI', 'NOI_DUNG'];
const COT_TIEN = ['GIA_BAN', 'GIA_VON', 'TONG_TIEN_HANG', 'TIEN_GIAM_GIA', 'TONG_THANH_TOAN', 'DA_THANH_TOAN',
  'TONG_GIA_VON', 'DON_GIA', 'GIAM_GIA', 'THANH_TIEN', 'SO_TIEN', 'TIEN_KHACH_DUA', 'TIEN_THOI_LAI'];
const COT_NGAY = ['NGAY_BAN', 'NGAY_BAT_DAU', 'NGAY_KET_THUC', 'NGAY_VAO_LAM'];
const COT_THOI_GIAN = ['NGAY_TAO', 'NGAY_CAP_NHAT', 'NGAY_THANH_TOAN', 'THOI_GIAN', 'LAN_DANG_NHAP_CUOI', 'THOI_GIAN_XU_LY'];

/* ============================ WEB APP ============================ */

function doGet(e) {
  // API cho trang khách gọi món (GitHub Pages) – xem GoiMon.gs
  if (e && e.parameter && e.parameter.api) return traJson_(apiKhach_(e.parameter));
  let q = {};
  try { q = thongTinQuanAnToan_(); } catch (e) { /* dùng mặc định */ }
  const cauHinh = { TEN_QUAN: q.TEN_QUAN || '', SLOGAN: q.SLOGAN || '', LOGO: q.LOGO || '', PHIEN_BAN: PHIEN_BAN_UNG_DUNG };
  // Mã hóa mọi ký tự đặc biệt thành \uXXXX: link logo (https://…), dấu nháy trong tên quán không làm hỏng mã JavaScript của trang
  const ma = JSON.stringify(cauHinh).replace(/[^A-Za-z0-9_ ]/g, c => '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4));
  const html = HtmlService.createHtmlOutputFromFile('Index').getContent()
    .replace("'__CAU_HINH__'", () => "JSON.parse('" + ma + "')");
  return HtmlService.createHtmlOutput(html)
    .setTitle(q.TEN_QUAN || 'Quản lý quán cafe')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('☕ Quản lý quán')
    .addItem('Khởi tạo / cập nhật cấu trúc', 'khoiTaoHeThong')
    .addItem('Mở ứng dụng bán hàng', 'moUngDung')
    .addItem('Kiểm tra hệ thống', 'kiemTraHeThong')
    .addItem('Làm mới dữ liệu ứng dụng', 'lamMoiDuLieu')
    .addItem('Cấp quyền Google Drive (ảnh món)', 'capQuyenDrive')
    .addSeparator()
    .addItem('Đặt lại mật khẩu tất cả về 123456', 'datLaiMatKhauMacDinh')
    .addToUi();
}

function moUngDung() {
  const url = ScriptApp.getService().getUrl();
  const html = url
    ? '<p style="font-family:sans-serif">Mở ứng dụng: <a href="' + url + '" target="_blank">' + url + '</a></p>'
    : '<p style="font-family:sans-serif">Chưa triển khai Web App. Vào Apps Script → Triển khai → Tùy chọn triển khai mới → Ứng dụng web.</p>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(460).setHeight(120), 'Ứng dụng bán hàng');
}

/* ===================== TIỆN ÍCH ĐỌC / GHI BẢNG ===================== */

const _TIEU_DE = {};
// Bộ nhớ tạm trong MỘT lượt gọi máy chủ (mỗi lượt google.script.run là một lần chạy mới nên luôn bắt đầu trống)
let _SS = null;
const _SHEET = {};
const _BANG = {};
function xoaBoNhoTam_(ten) {
  if (ten) { delete _BANG[ten]; return; }
  Object.keys(_BANG).forEach(function (k) { delete _BANG[k]; });
  Object.keys(_SHEET).forEach(function (k) { delete _SHEET[k]; });
  Object.keys(_TIEU_DE).forEach(function (k) { delete _TIEU_DE[k]; });
}

function ss_() {
  if (_SS) return _SS;
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  _SS = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
  return _SS;
}

let _DA_TU_SUA = false;

function sheet_(ten) {
  if (_SHEET[ten]) return _SHEET[ten];
  let sh = ss_().getSheetByName(ten);
  if (sh) return (_SHEET[ten] = sh);
  if (!CAU_TRUC[ten]) throw new Error('Không tìm thấy bảng ' + ten + '.');
  // Thiếu bảng (thường do vừa nâng cấp code mà chưa chạy khởi tạo): tự bổ sung cấu trúc.
  // Việc này rất nặng nên mỗi 10 phút chỉ thử một lần; các lần sau chỉ tạo riêng bảng thiếu.
  let loiSua = '';
  const cache = CacheService.getScriptCache();
  if (!_DA_TU_SUA && !cache.get('DA_THU_SUA_CAU_TRUC')) {
    _DA_TU_SUA = true;
    cache.put('DA_THU_SUA_CAU_TRUC', '1', 600);
    try { capNhatCauTruc_(); } catch (e) { loiSua = e.message; console.error('capNhatCauTruc_: ' + (e.stack || e)); }
    xoaBoNhoTam_();
    sh = ss_().getSheetByName(ten);
    if (sh) return (_SHEET[ten] = sh);
  }
  if (cache.get('TAO_LOI_' + ten)) throw new Error('Không tạo được bảng ' + ten + ' (đã thử trong 10 phút qua). Hãy chạy hàm kiemTraHeThong trong Apps Script.');
  sh = taoBangDon_(ten);
  if (sh) return (_SHEET[ten] = sh);
  cache.put('TAO_LOI_' + ten, '1', 600);
  throw new Error('Không tạo được bảng ' + ten + ' trong file "' + ss_().getName() + '".' +
    (loiSua ? ' Chi tiết: ' + loiSua : '') + ' Hãy chạy hàm kiemTraHeThong trong Apps Script.');
}

/** Lấy bảng; nếu chưa có thì tạo. An toàn khi nhiều yêu cầu cùng tạo một lúc. */
function layHoacTaoBang_(ss, ten) {
  let sh = ss.getSheetByName(ten);
  if (sh) return { sh: sh, moi: false };
  try { return { sh: ss.insertSheet(ten), moi: true }; }
  catch (e) {
    Utilities.sleep(500);
    sh = ss.getSheetByName(ten);
    if (sh) return { sh: sh, moi: false };
    throw e;
  }
}

/** Phương án dự phòng: chỉ tạo một bảng còn thiếu cùng dòng tiêu đề và dữ liệu cần thiết. */
function taoBangDon_(ten) {
  let sh;
  try { sh = layHoacTaoBang_(ss_(), ten).sh; } catch (e) { console.error('taoBangDon_ ' + ten + ': ' + e); return null; }
  const cot = CAU_TRUC[ten];
  if (sh.getLastColumn() === 0) {
    sh.getRange(1, 1, 1, cot.length).setValues([cot]).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#6F4E37');
    sh.setFrozenRows(1);
  }
  delete _TIEU_DE[ten];
  try {
    if (ten === 'HT_THONGTINQUAN') napThongTinQuan_();
    if (ten === 'NS_TAIKHOAN' && !chuyenDoiTaiKhoan_()) napTaiKhoanMau_();
  } catch (e) { console.error('taoBangDon_ nạp dữ liệu ' + ten + ': ' + e); }
  return sh;
}

function tieuDe_(ten) {
  if (!_TIEU_DE[ten]) {
    const sh = sheet_(ten);
    _TIEU_DE[ten] = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  }
  return _TIEU_DE[ten];
}

function chuanHoa_(v) {
  if (v instanceof Date) {
    if (v.getFullYear() < 1900) return Utilities.formatDate(v, MUI_GIO, 'HH:mm');
    const s = Utilities.formatDate(v, MUI_GIO, 'yyyy-MM-dd HH:mm:ss');
    return s.slice(11) === '00:00:00' ? s.slice(0, 10) : s;
  }
  return v;
}

/** Đọc toàn bộ bảng thành mảng đối tượng {TEN_COT: giá trị, _row: số dòng}. */
function docBang_(ten) {
  if (_BANG[ten]) return _BANG[ten].slice();
  const sh = sheet_(ten);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) { _BANG[ten] = []; return []; }
  const td = tieuDe_(ten);
  const values = sh.getRange(2, 1, lastRow - 1, td.length).getValues();
  const kq = [];
  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    if (r.every(function (v) { return v === '' || v === null; })) continue;
    const o = { _row: i + 2 };
    for (let j = 0; j < td.length; j++) if (td[j]) o[td[j]] = chuanHoa_(r[j]);
    kq.push(o);
  }
  _BANG[ten] = kq;
  return kq.slice();
}

/* ---------- BỘ NHỚ ĐỆM DANH MỤC (CacheService) ----------
   Danh mục ít thay đổi nên được nhớ tạm; tự xóa khi có thay đổi (qua ứng dụng hoặc sửa tay trên Sheet). */
const BANG_DANH_MUC = ['DM_SANPHAM', 'DM_NHOMSANPHAM', 'DM_BAN', 'DM_KHUVUC', 'DM_PHUONGTHUCTHANHTOAN', 'BH_GIAMGIA',
  'HT_THONGTINQUAN', 'DM_CHINHANH'];
function docDem_(khoa) {
  try { const s = CacheService.getScriptCache().get(khoa); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function ghiDem_(khoa, giaTri, giay) {
  try { const s = JSON.stringify(giaTri); if (s.length < 95000) CacheService.getScriptCache().put(khoa, s, giay); } catch (e) { /* bỏ qua */ }
}
let _KHOA_DEM = null; // danh sách khóa cần xóa, tính một lần mỗi lượt chạy
function xoaCacheDanhMuc_() {
  try {
    if (!_KHOA_DEM) {
      const nay = homNay_();
      _KHOA_DEM = ['TTQ', 'DMKT||' + nay];
      docBang_('DM_CHINHANH').forEach(function (cn) { _KHOA_DEM.push('DMKT|' + cn.MA_CHI_NHANH + '|' + nay); });
    }
    CacheService.getScriptCache().removeAll(_KHOA_DEM);
  } catch (e) { console.error('xoaCacheDanhMuc_: ' + e); }
}
function danhDauDanhMuc_(ten) {
  if (BANG_DANH_MUC.indexOf(ten) < 0) return;
  if (ten === 'DM_CHINHANH') _KHOA_DEM = null; // chi nhánh thay đổi → tính lại danh sách khóa (đã ghi xong)
  xoaCacheDanhMuc_();
}
/** Sửa tay danh mục trên Google Sheet → xóa bộ nhớ đệm để ứng dụng thấy ngay. */
function onEdit(e) {
  try { if (e && e.range && BANG_DANH_MUC.indexOf(e.range.getSheet().getName()) >= 0) xoaCacheDanhMuc_(); } catch (err) { /* bỏ qua */ }
}
function lamMoiDuLieu() {
  xoaCacheDanhMuc_();
  try { SpreadsheetApp.getUi().alert('Đã làm mới dữ liệu. Các máy bán hàng sẽ thấy danh mục mới khi tải lại trang.'); } catch (e) { /* bỏ qua */ }
}

/* ---------- ĐỌC CÓ CHỌN LỌC: không đọc cả bảng giao dịch (bảng lớn dần theo thời gian) ---------- */

/** Đọc các dòng theo số dòng; gom các dòng gần nhau thành một lần đọc. */
function docCacDong_(ten, rows) {
  if (!rows.length) return [];
  const sh = sheet_(ten), td = tieuDe_(ten), kq = [];
  rows = rows.slice().sort(function (a, b) { return a - b; });
  let i = 0;
  while (i < rows.length) {
    let k = i;
    while (k + 1 < rows.length && rows[k + 1] - rows[k] <= 25) k++;
    const dau = rows[i], vals = sh.getRange(dau, 1, rows[k] - dau + 1, td.length).getValues();
    for (let t = i; t <= k; t++) {
      if (t > i && rows[t] === rows[t - 1]) continue;
      const r = vals[rows[t] - dau], o = { _row: rows[t] };
      for (let j = 0; j < td.length; j++) if (td[j]) o[td[j]] = chuanHoa_(r[j]);
      kq.push(o);
    }
    i = k + 1;
  }
  return kq;
}

/** Các dòng có cột `cot` đúng bằng `giaTri` (dùng TextFinder của Google Sheets, chỉ đọc dòng khớp). */
function timDong_(ten, cot, giaTri) {
  if (giaTri === '' || giaTri == null) return [];
  const gt = String(giaTri);
  if (_BANG[ten]) return _BANG[ten].filter(function (r) { return String(r[cot]) === gt; });
  const sh = sheet_(ten), j = tieuDe_(ten).indexOf(cot);
  if (j < 0) throw new Error('Bảng ' + ten + ' thiếu cột ' + cot + '. Hãy chạy lại "Khởi tạo hệ thống".');
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, j + 1, last - 1, 1).createTextFinder(gt).matchCase(true).matchEntireCell(true).findAll()
    .map(function (r) { return r.getRow(); });
  return docCacDong_(ten, rows).filter(function (r) { return String(r[cot]) === gt; });
}

/**
 * Đọc riêng một cột để lọc, rồi chỉ đọc đầy đủ những dòng thỏa điều kiện.
 * daQua(v) (không bắt buộc): giá trị chắc chắn cũ hơn khoảng cần tìm. Bảng giao dịch luôn ghi thêm ở cuối,
 * nên đọc từ dưới lên từng khối 1000 dòng và dừng khi cả khối đều "đã qua" → không đọc toàn bộ lịch sử.
 */
function docDongLoc_(ten, cot, dieuKien, daQua) {
  if (_BANG[ten]) return _BANG[ten].filter(function (r) { return dieuKien(r[cot]); });
  const sh = sheet_(ten), j = tieuDe_(ten).indexOf(cot);
  if (j < 0) throw new Error('Bảng ' + ten + ' thiếu cột ' + cot + '.');
  const last = sh.getLastRow();
  if (last < 2) return [];
  const rows = [];
  if (!daQua) {
    const cotVals = sh.getRange(2, j + 1, last - 1, 1).getValues();
    for (let i = 0; i < cotVals.length; i++) if (dieuKien(chuanHoa_(cotVals[i][0]))) rows.push(i + 2);
    return docCacDong_(ten, rows);
  }
  const KHOI = 1000;
  let den = last;
  while (den >= 2) {
    const tu = Math.max(2, den - KHOI + 1);
    const vals = sh.getRange(tu, j + 1, den - tu + 1, 1).getValues();
    let tatCaQua = true;
    for (let i = vals.length - 1; i >= 0; i--) {
      const v = chuanHoa_(vals[i][0]);
      if (dieuKien(v)) rows.push(tu + i);
      if (tatCaQua && !daQua(v)) tatCaQua = false;
    }
    if (tatCaQua) break;
    den = tu - 1;
  }
  return docCacDong_(ten, rows.reverse());
}
/** Ngày tạo nằm trong mã hóa đơn (HD-CN01-261120-0001 → 2026-11-20); mã không đúng mẫu trả về ''. */
function ngayMaHD_(ma) {
  const m = /-(\d{2})(\d{2})(\d{2})-\d+$/.exec(String(ma || ''));
  return m ? '20' + m[1] + '-' + m[2] + '-' + m[3] : '';
}
/** daQua cho cột MA_HOA_DON: hóa đơn tạo trước ngày `tu` */
function hdTruocNgay_(tu) { return function (v) { const n = ngayMaHD_(v); return !!n && n < tu; }; }
/** daQua cho cột ngày */
function ngayTruoc_(tu) { return function (v) { const n = String(v || '').slice(0, 10); return !!n && n < tu; }; }

/** Nhiều giá trị cùng lúc trong một cột: một lần tìm bằng biểu thức chính quy thay cho nhiều lần tìm. */
function timNhieuDong_(ten, cot, giaTris) {
  const ds = giaTris.filter(function (x, i) { return x !== '' && x != null && giaTris.indexOf(x) === i; }).map(String);
  if (!ds.length) return [];
  const can = {}; ds.forEach(function (x) { can[x] = true; });
  if (_BANG[ten]) return _BANG[ten].filter(function (r) { return can[String(r[cot])]; });
  const sh = sheet_(ten), j = tieuDe_(ten).indexOf(cot);
  if (j < 0) throw new Error('Bảng ' + ten + ' thiếu cột ' + cot + '.');
  const last = sh.getLastRow();
  if (last < 2) return [];
  const kq = [];
  for (let i = 0; i < ds.length; i += 100) {
    const mau = '^(' + ds.slice(i, i + 100).map(function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')$';
    const rows = sh.getRange(2, j + 1, last - 1, 1).createTextFinder(mau).useRegularExpression(true).matchCase(true).findAll()
      .map(function (r) { return r.getRow(); });
    docCacDong_(ten, rows).forEach(function (r) { if (can[String(r[cot])]) kq.push(r); });
  }
  return kq;
}

/** Ghi cùng một giá trị vào một cột cho nhiều dòng: gom các dòng liền nhau thành một lần ghi. */
function ghiCot_(ten, cot, rows, giaTri) {
  if (!rows.length) return;
  xoaBoNhoTam_(ten);
  const sh = sheet_(ten), j = tieuDe_(ten).indexOf(cot) + 1;
  rows = rows.slice().sort(function (a, b) { return a - b; });
  let i = 0;
  while (i < rows.length) {
    let k = i;
    while (k + 1 < rows.length && rows[k + 1] === rows[k] + 1) k++;
    const n = rows[k] - rows[i] + 1, v = [];
    for (let t = 0; t < n; t++) v.push([giaTri]);
    sh.getRange(rows[i], j, n, 1).setValues(v);
    i = k + 1;
  }
  xoaBoNhoTam_(ten);
}

function themDong_(ten, ds) {
  if (!ds.length) return;
  xoaBoNhoTam_(ten);
  const sh = sheet_(ten);
  const td = tieuDe_(ten);
  const rows = ds.map(function (o) {
    return td.map(function (h) {
      const v = o[h];
      if (v === undefined || v === null) return '';
      return COT_VAN_BAN.indexOf(h) >= 0 ? String(v) : v;
    });
  });
  const start = sh.getLastRow() + 1;
  const can = start + rows.length - 1;
  if (can > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), can - sh.getMaxRows() + 100);
  td.forEach(function (h, j) {
    if (COT_VAN_BAN.indexOf(h) >= 0) sh.getRange(start, j + 1, rows.length, 1).setNumberFormat('@');
  });
  sh.getRange(start, 1, rows.length, td.length).setValues(rows);
  xoaBoNhoTam_(ten);
  danhDauDanhMuc_(ten); // xóa bộ nhớ đệm danh mục SAU khi ghi xong
}

function capNhat_(ten, row, patch) {
  xoaBoNhoTam_(ten);
  const sh = sheet_(ten);
  const td = tieuDe_(ten);
  Object.keys(patch).forEach(function (k) {
    const j = td.indexOf(k);
    if (j < 0) throw new Error('Bảng ' + ten + ' thiếu cột ' + k + '. Hãy chạy lại "Khởi tạo hệ thống".');
    const o = sh.getRange(row, j + 1);
    if (COT_VAN_BAN.indexOf(k) >= 0) { o.setNumberFormat('@'); o.setValue(String(patch[k])); }
    else o.setValue(patch[k] === undefined || patch[k] === null ? '' : patch[k]);
  });
  xoaBoNhoTam_(ten);
  danhDauDanhMuc_(ten);
}

function soTiepTheo_(khoa) {
  const sh = sheet_('HT_BODEM');
  const last = sh.getLastRow();
  if (last >= 2) {
    const vals = sh.getRange(2, 1, last - 1, 2).getValues();
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) === khoa) {
        const moi = (Number(vals[i][1]) || 0) + 1;
        sh.getRange(i + 2, 2).setValue(moi);
        return moi;
      }
    }
  }
  sh.appendRow([khoa, 1]);
  return 1;
}

function voiKhoa_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Hệ thống đang bận, vui lòng thử lại sau vài giây.');
  try { return fn(); }
  finally { SpreadsheetApp.flush(); lock.releaseLock(); }
}

function so_(v) { const n = Number(v); return isFinite(n) ? n : 0; }
function dem_(n, w) { return String(n).padStart(w, '0'); }
function homNay_() { return Utilities.formatDate(new Date(), MUI_GIO, 'yyyy-MM-dd'); }
function ngayThuan_() { const s = homNay_().split('-'); return new Date(+s[0], +s[1] - 1, +s[2]); }
function tien_(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }

/* ============================ DỮ LIỆU KHỞI TẠO ============================ */

function theoThuTu_(a, b) { return so_(a.THU_TU) - so_(b.THU_TU); }

function giamGiaHopLe_(cn) {
  const nay = homNay_();
  return docBang_('BH_GIAMGIA').filter(function (g) {
    return g.TRANG_THAI === TT.HOAT_DONG &&
      (!g.MA_CHI_NHANH || g.MA_CHI_NHANH === '*' || g.MA_CHI_NHANH === cn) &&
      (!g.NGAY_BAT_DAU || String(g.NGAY_BAT_DAU).slice(0, 10) <= nay) &&
      (!g.NGAY_KET_THUC || String(g.NGAY_KET_THUC).slice(0, 10) >= nay);
  });
}

function layDuLieuKhoiTao(token) {
  return duLieuKhoiTao_(phien_(token));
}

/** Toàn bộ dữ liệu màn hình bán hàng, kèm danh sách hóa đơn đang mở (để không phải gọi máy chủ thêm lần nữa). */
function duLieuKhoiTao_(p) {
  const khoa = 'DMKT|' + p.MA_CHI_NHANH + '|' + homNay_();
  let dm = docDem_(khoa);
  if (!dm) { dm = danhMucBanHang_(p.MA_CHI_NHANH); ghiDem_(khoa, dm, 300); }
  dm.hdMo = hoaDonDangMo_(p);
  dm.phien = congKhai_(p);
  return dm;
}

function danhMucBanHang_(cn) {
  return {
    thongTinQuan: thongTinQuanAnToan_(),
    nhom: docBang_('DM_NHOMSANPHAM').filter(function (n) { return n.TRANG_THAI !== TT.NGUNG; }).sort(theoThuTu_)
      .map(function (n) { return { MA_NHOM_SAN_PHAM: n.MA_NHOM_SAN_PHAM, TEN_NHOM_SAN_PHAM: n.TEN_NHOM_SAN_PHAM }; }),
    sanPham: docBang_('DM_SANPHAM').filter(function (s) { return s.TRANG_THAI === TT.DANG_BAN; }).sort(theoThuTu_)
      .map(function (s) {
        return { MA_SAN_PHAM: s.MA_SAN_PHAM, TEN_SAN_PHAM: s.TEN_SAN_PHAM, MA_NHOM_SAN_PHAM: s.MA_NHOM_SAN_PHAM,
          DON_VI_TINH: s.DON_VI_TINH, GIA_BAN: so_(s.GIA_BAN), HINH_ANH: s.HINH_ANH || '' };
      }),
    khuVuc: docBang_('DM_KHUVUC').filter(function (k) { return k.MA_CHI_NHANH === cn && k.TRANG_THAI !== TT.NGUNG; })
      .sort(theoThuTu_).map(function (k) { return { MA_KHU_VUC: k.MA_KHU_VUC, TEN_KHU_VUC: k.TEN_KHU_VUC }; }),
    ban: docBang_('DM_BAN').filter(function (b) { return b.MA_CHI_NHANH === cn && b.TRANG_THAI !== TT.NGUNG; })
      .sort(theoThuTu_).map(function (b) {
        return { MA_BAN: b.MA_BAN, MA_KHU_VUC: b.MA_KHU_VUC, TEN_BAN: b.TEN_BAN, SO_CHO: b.SO_CHO };
      }),
    phuongThuc: docBang_('DM_PHUONGTHUCTHANHTOAN').filter(function (x) { return x.TRANG_THAI !== TT.NGUNG; })
      .sort(theoThuTu_).map(function (x) { return { MA_PHUONG_THUC: x.MA_PHUONG_THUC, TEN_PHUONG_THUC: x.TEN_PHUONG_THUC }; }),
    giamGia: giamGiaHopLe_(cn).map(function (g) {
      return { MA_GIAM_GIA: g.MA_GIAM_GIA, TEN_CHUONG_TRINH: g.TEN_CHUONG_TRINH, LOAI_GIAM: g.LOAI_GIAM, GIA_TRI: so_(g.GIA_TRI) };
    })
  };
}

/* ============================ HÓA ĐƠN ============================ */

function layTrangThaiBan(token) {
  return hoaDonDangMo_(phien_(token));
}

/** Hóa đơn đang phục vụ của chi nhánh: chỉ đọc các dòng có trạng thái "Đang phục vụ". */
function dangMo_(cn) {
  return timDong_('BH_HOADON', 'TRANG_THAI', TT.HD_DANG_PHUC_VU).filter(function (h) { return !cn || h.MA_CHI_NHANH === cn; });
}

function hoaDonDangMo_(p) {
  return dangMo_(p.MA_CHI_NHANH).map(function (h) {
    return { MA_HOA_DON: h.MA_HOA_DON, LOAI_DON: h.LOAI_DON, MA_BAN: h.MA_BAN, TONG_THANH_TOAN: so_(h.TONG_THANH_TOAN),
      DA_THANH_TOAN: so_(h.DA_THANH_TOAN), NGAY_TAO: h.NGAY_TAO, GHI_CHU: h.GHI_CHU };
  });
}

function timHoaDon_(maHD, p) {
  const hd = timDong_('BH_HOADON', 'MA_HOA_DON', maHD)[0];
  if (!hd) throw new Error('Không tìm thấy hóa đơn ' + maHD + '.');
  if (hd.MA_CHI_NHANH !== p.MA_CHI_NHANH) throw new Error('Hóa đơn không thuộc chi nhánh đang đăng nhập.');
  return hd;
}

function chiTietHoaDon_(maHD, p) {
  const hd = timHoaDon_(maHD, p);
  const ban = hd.MA_BAN ? timDong_('DM_BAN', 'MA_BAN', hd.MA_BAN)[0] : null;
  const ptMap = {};
  docBang_('DM_PHUONGTHUCTHANHTOAN').forEach(function (x) { ptMap[x.MA_PHUONG_THUC] = x.TEN_PHUONG_THUC; });
  const khach = hd.MA_KHACH_HANG
    ? timDong_('DM_KHACHHANG', 'MA_KHACH_HANG', hd.MA_KHACH_HANG)[0] : null;
  const xemVon = NHOM_QUYEN.XEM_GIA_VON.indexOf(p.VAI_TRO) >= 0;
  const sach = function (o) {
    const r = {};
    Object.keys(o).forEach(function (k) {
      if (k === '_row') return;
      if (!xemVon && (k === 'GIA_VON' || k === 'TONG_GIA_VON')) return;
      r[k] = o[k];
    });
    return r;
  };
  return {
    hoaDon: sach(hd),
    tenBan: ban ? ban.TEN_BAN : '',
    khachHang: khach ? { TEN_KHACH_HANG: khach.TEN_KHACH_HANG, SO_DIEN_THOAI: khach.SO_DIEN_THOAI } : null,
    chiTiet: timDong_('BH_CHITIETHOADON', 'MA_HOA_DON', maHD).map(sach),
    thanhToan: timDong_('BH_THANHTOAN', 'MA_HOA_DON', maHD).map(function (t) {
      const r = sach(t); r.TEN_PHUONG_THUC = ptMap[t.MA_PHUONG_THUC] || t.MA_PHUONG_THUC; return r;
    })
  };
}

function layHoaDon(token, maHD) {
  return chiTietHoaDon_(maHD, phien_(token));
}

function ghiLichSu_(maHD, loai, noiDung, p) {
  themDong_('BH_LICHSUHANG', [{
    MA_LICH_SU: 'LS' + dem_(soTiepTheo_('LS'), 8), MA_HOA_DON: maHD, THOI_GIAN: new Date(),
    LOAI_THAO_TAC: loai, NOI_DUNG: noiDung, NGUOI_THUC_HIEN: p.MA_NHAN_VIEN
  }]);
}

function tinhGiam_(loai, giaTri, tong) {
  const gt = Math.max(0, so_(giaTri));
  if (loai === LOAI_GIAM.PHAN_TRAM) return Math.round(tong * Math.min(100, gt) / 100);
  if (loai === LOAI_GIAM.SO_TIEN) return Math.min(tong, Math.round(gt));
  return 0;
}

/** Tính lại tổng tiền hóa đơn từ các dòng chi tiết còn hiệu lực. */
function tinhLaiHoaDon_(maHD, patchGiam) {
  const hd = timDong_('BH_HOADON', 'MA_HOA_DON', maHD)[0];
  const ct = timDong_('BH_CHITIETHOADON', 'MA_HOA_DON', maHD).filter(function (c) { return c.TRANG_THAI !== TT.CT_DA_HUY; });
  let tong = 0, von = 0;
  ct.forEach(function (c) { tong += so_(c.THANH_TIEN); von += so_(c.SO_LUONG) * so_(c.GIA_VON); });
  const g = patchGiam || hd;
  const giam = tinhGiam_(g.LOAI_GIAM, g.GIA_TRI_GIAM, tong);
  const patch = {
    TONG_TIEN_HANG: tong, TIEN_GIAM_GIA: giam, TONG_THANH_TOAN: tong - giam,
    TONG_GIA_VON: Math.round(von), NGAY_CAP_NHAT: new Date()
  };
  if (patchGiam) {
    patch.MA_GIAM_GIA = patchGiam.MA_GIAM_GIA; patch.LOAI_GIAM = patchGiam.LOAI_GIAM; patch.GIA_TRI_GIAM = patchGiam.GIA_TRI_GIAM;
  }
  capNhat_('BH_HOADON', hd._row, patch);
  return patch;
}

function taoHoaDon_(p, loaiDon, maBan, ghiChu) {
  const cn = p.MA_CHI_NHANH;
  if (loaiDon !== LOAI_DON.MANG_DI) {
    loaiDon = LOAI_DON.TAI_BAN;
    const ban = timDong_('DM_BAN', 'MA_BAN', maBan)[0];
    if (!ban || ban.MA_CHI_NHANH !== cn) throw new Error('Bàn không hợp lệ.');
    const dangMo = dangMo_(cn).filter(function (h) { return h.MA_BAN === maBan && h.LOAI_DON === LOAI_DON.TAI_BAN; })[0];
    if (dangMo) return dangMo.MA_HOA_DON; // bàn đã có hóa đơn mở → gộp vào
  } else {
    maBan = '';
  }
  const now = new Date();
  const ngay = Utilities.formatDate(now, MUI_GIO, 'yyMMdd');
  const maHD = 'HD-' + cn + '-' + ngay + '-' + dem_(soTiepTheo_('HD|' + cn + '|' + ngay), 4);
  themDong_('BH_HOADON', [{
    MA_HOA_DON: maHD, MA_CHI_NHANH: cn, NGAY_BAN: ngayThuan_(), GIO_BAN: Utilities.formatDate(now, MUI_GIO, 'HH:mm'),
    LOAI_DON: loaiDon, MA_BAN: maBan, MA_NHAN_VIEN: p.MA_NHAN_VIEN, MA_KHACH_HANG: '',
    TONG_TIEN_HANG: 0, MA_GIAM_GIA: '', LOAI_GIAM: '', GIA_TRI_GIAM: 0, TIEN_GIAM_GIA: 0,
    TONG_THANH_TOAN: 0, DA_THANH_TOAN: 0, TONG_GIA_VON: 0, TRANG_THAI: TT.HD_DANG_PHUC_VU,
    NGAY_TAO: now, NGUOI_TAO: p.MA_NHAN_VIEN, NGAY_CAP_NHAT: now, GHI_CHU: ghiChu || ''
  }]);
  ghiLichSu_(maHD, 'Tạo hóa đơn', loaiDon + (maBan ? ' – ' + maBan : ''), p);
  return maHD;
}

/**
 * Gửi món: tạo hóa đơn nếu chưa có, thêm các dòng món.
 * duLieu = { maHoaDon?, loaiDon, maBan, ghiChu, items: [{maSanPham, soLuong, ghiChu}] }
 */
function guiMon(token, duLieu) {
  const p = phien_(token);
  yeuCau_(p, NHOM_QUYEN.BAN_HANG);
  return guiMon_(p, duLieu);
}

function guiMon_(p, duLieu) {
  const items = (duLieu && duLieu.items) || [];
  if (!items.length) throw new Error('Chưa chọn món nào.');
  return voiKhoa_(function () {
    const maHD = duLieu.maHoaDon || taoHoaDon_(p, duLieu.loaiDon, duLieu.maBan, duLieu.ghiChu);
    const hd = timHoaDon_(maHD, p);
    if (hd.TRANG_THAI !== TT.HD_DANG_PHUC_VU) throw new Error('Hóa đơn không còn ở trạng thái phục vụ.');

    const spMap = {};
    docBang_('DM_SANPHAM').forEach(function (s) { spMap[s.MA_SAN_PHAM] = s; });
    let stt = timDong_('BH_CHITIETHOADON', 'MA_HOA_DON', maHD).length;
    const now = new Date();
    const rows = [], moTa = [];
    items.forEach(function (it) {
      const sp = spMap[it.maSanPham];
      if (!sp || sp.TRANG_THAI !== TT.DANG_BAN) throw new Error('Món "' + (sp ? sp.TEN_SAN_PHAM : it.maSanPham) + '" hiện không bán.');
      const sl = Math.floor(so_(it.soLuong));
      if (!(sl > 0 && sl <= 999)) throw new Error('Số lượng món "' + sp.TEN_SAN_PHAM + '" không hợp lệ.');
      stt++;
      const dg = so_(sp.GIA_BAN);
      rows.push({
        MA_CHI_TIET: maHD + '-' + dem_(stt, 2), MA_HOA_DON: maHD, MA_SAN_PHAM: sp.MA_SAN_PHAM,
        TEN_SAN_PHAM: sp.TEN_SAN_PHAM, SO_LUONG: sl, DON_GIA: dg, GIA_VON: so_(sp.GIA_VON), GIAM_GIA: 0,
        THANH_TIEN: sl * dg, TRANG_THAI_PHA_CHE: TT.PC_CHO, TRANG_THAI: TT.CT_HOAT_DONG,
        NGAY_TAO: now, NGUOI_TAO: p.MA_NHAN_VIEN, GHI_CHU: String(it.ghiChu || '').slice(0, 200)
      });
      moTa.push(sl + ' x ' + sp.TEN_SAN_PHAM);
    });
    themDong_('BH_CHITIETHOADON', rows);
    tinhLaiHoaDon_(maHD);
    ghiLichSu_(maHD, 'Thêm món', moTa.join(', ') + (duLieu.nguon ? ' [' + duLieu.nguon + ']' : ''), p);
    return chiTietHoaDon_(maHD, p);
  });
}

function huyMon(token, maCT, lyDo) {
  const p = phien_(token);
  yeuCau_(p, NHOM_QUYEN.BAN_HANG);
  lyDo = String(lyDo || '').trim();
  if (!lyDo) throw new Error('Vui lòng nhập lý do hủy món.');
  return voiKhoa_(function () {
    const ct = timDong_('BH_CHITIETHOADON', 'MA_CHI_TIET', maCT)[0];
    if (!ct) throw new Error('Không tìm thấy món.');
    if (ct.TRANG_THAI === TT.CT_DA_HUY) throw new Error('Món đã được hủy trước đó.');
    const hd = timHoaDon_(ct.MA_HOA_DON, p);
    if (hd.TRANG_THAI !== TT.HD_DANG_PHUC_VU) throw new Error('Hóa đơn không còn ở trạng thái phục vụ.');
    if (ct.TRANG_THAI_PHA_CHE === TT.PC_XONG) yeuCau_(p, NHOM_QUYEN.HUY_MON_DA_PHA);
    const tongMoi = so_(hd.TONG_TIEN_HANG) - so_(ct.THANH_TIEN);
    const phaiTraMoi = tongMoi - tinhGiam_(hd.LOAI_GIAM, hd.GIA_TRI_GIAM, tongMoi);
    if (so_(hd.DA_THANH_TOAN) > phaiTraMoi) throw new Error('Không thể hủy: khách đã thanh toán nhiều hơn tổng tiền sau khi hủy.');
    capNhat_('BH_CHITIETHOADON', ct._row, {
      TRANG_THAI: TT.CT_DA_HUY, GHI_CHU: (ct.GHI_CHU ? ct.GHI_CHU + ' | ' : '') + 'Hủy: ' + lyDo
    });
    tinhLaiHoaDon_(hd.MA_HOA_DON);
    ghiLichSu_(hd.MA_HOA_DON, 'Hủy món', ct.SO_LUONG + ' x ' + ct.TEN_SAN_PHAM + ' – ' + lyDo, p);
    return chiTietHoaDon_(hd.MA_HOA_DON, p);
  });
}

function chuyenBan(token, maHD, maBanMoi) {
  const p = phien_(token);
  yeuCau_(p, NHOM_QUYEN.BAN_HANG);
  return voiKhoa_(function () {
    const hd = timHoaDon_(maHD, p);
    if (hd.TRANG_THAI !== TT.HD_DANG_PHUC_VU) throw new Error('Hóa đơn không còn ở trạng thái phục vụ.');
    const ban = timDong_('DM_BAN', 'MA_BAN', maBanMoi)[0];
    if (!ban || ban.MA_CHI_NHANH !== p.MA_CHI_NHANH || ban.TRANG_THAI === TT.NGUNG) throw new Error('Bàn mới không hợp lệ.');
    const coKhach = dangMo_(p.MA_CHI_NHANH).some(function (h) { return h.MA_BAN === maBanMoi && h.MA_HOA_DON !== maHD; });
    if (coKhach) throw new Error(ban.TEN_BAN + ' đang có khách.');
    capNhat_('BH_HOADON', hd._row, { MA_BAN: maBanMoi, LOAI_DON: LOAI_DON.TAI_BAN, NGAY_CAP_NHAT: new Date() });
    ghiLichSu_(maHD, 'Chuyển bàn', (hd.MA_BAN || 'Mang đi') + ' → ' + maBanMoi, p);
    return chiTietHoaDon_(maHD, p);
  });
}

function huyHoaDon(token, maHD, lyDo) {
  const p = phien_(token);
  lyDo = String(lyDo || '').trim();
  if (!lyDo) throw new Error('Vui lòng nhập lý do hủy hóa đơn.');
  return voiKhoa_(function () {
    const hd = timHoaDon_(maHD, p);
    if (hd.TRANG_THAI !== TT.HD_DANG_PHUC_VU) throw new Error('Chỉ hủy được hóa đơn đang phục vụ.');
    if (so_(hd.DA_THANH_TOAN) > 0) throw new Error('Hóa đơn đã có thanh toán, không thể hủy.');
    // Hóa đơn trống: nhân viên bán hàng được hủy. Có món: cần quản lý.
    const coMon = timDong_('BH_CHITIETHOADON', 'MA_HOA_DON', maHD).some(function (c) { return c.TRANG_THAI !== TT.CT_DA_HUY; });
    yeuCau_(p, coMon ? NHOM_QUYEN.HUY_HOA_DON : NHOM_QUYEN.BAN_HANG);
    capNhat_('BH_HOADON', hd._row, {
      TRANG_THAI: TT.HD_DA_HUY, NGAY_CAP_NHAT: new Date(),
      GHI_CHU: (hd.GHI_CHU ? hd.GHI_CHU + ' | ' : '') + 'Hủy: ' + lyDo
    });
    ghiLichSu_(maHD, 'Hủy hóa đơn', lyDo, p);
    return true;
  });
}

function timHoacTaoKhach_(kh, p) {
  const sdt = String(kh.soDienThoai || '').replace(/\D/g, '');
  if (sdt.length < 9) throw new Error('Số điện thoại khách hàng không hợp lệ.');
  const daCo = timDong_('DM_KHACHHANG', 'SO_DIEN_THOAI', sdt)[0];
  if (daCo) return daCo.MA_KHACH_HANG;
  const ma = 'KH' + dem_(soTiepTheo_('KH'), 5);
  themDong_('DM_KHACHHANG', [{
    MA_KHACH_HANG: ma, TEN_KHACH_HANG: String(kh.ten || '').trim() || 'Khách ' + sdt.slice(-4),
    SO_DIEN_THOAI: sdt, NGAY_TAO: new Date(), NGUOI_TAO: p.MA_NHAN_VIEN, GHI_CHU: ''
  }]);
  return ma;
}

function timKhachHang(token, soDienThoai) {
  phien_(token);
  const sdt = String(soDienThoai || '').replace(/\D/g, '');
  if (!sdt) return null;
  const k = timDong_('DM_KHACHHANG', 'SO_DIEN_THOAI', sdt)[0];
  return k ? { MA_KHACH_HANG: k.MA_KHACH_HANG, TEN_KHACH_HANG: k.TEN_KHACH_HANG, SO_DIEN_THOAI: k.SO_DIEN_THOAI } : null;
}

/**
 * Thanh toán (cho phép nhiều phương thức / nhiều lần).
 * dl = { giamGia: {maGiamGia} | {loai, giaTri} | null,
 *        khachHang: {soDienThoai, ten} | null,
 *        khoanThanhToan: [{maPhuongThuc, soTien, tienKhachDua}] }
 */
function thanhToan(token, maHD, dl) {
  const p = phien_(token);
  yeuCau_(p, NHOM_QUYEN.THANH_TOAN);
  dl = dl || {};
  return voiKhoa_(function () {
    let hd = timHoaDon_(maHD, p);
    if (hd.TRANG_THAI !== TT.HD_DANG_PHUC_VU) throw new Error('Hóa đơn không còn ở trạng thái phục vụ.');
    const coMon = timDong_('BH_CHITIETHOADON', 'MA_HOA_DON', maHD).some(function (c) { return c.TRANG_THAI !== TT.CT_DA_HUY; });
    if (!coMon) throw new Error('Hóa đơn chưa có món nào.');

    // Giảm giá chỉ được thay đổi khi chưa có khoản thanh toán nào
    if (so_(hd.DA_THANH_TOAN) === 0) {
      let g = { MA_GIAM_GIA: '', LOAI_GIAM: '', GIA_TRI_GIAM: 0 };
      const yc = dl.giamGia;
      if (yc && yc.maGiamGia) {
        const ct = giamGiaHopLe_(p.MA_CHI_NHANH).filter(function (x) { return x.MA_GIAM_GIA === yc.maGiamGia; })[0];
        if (!ct) throw new Error('Chương trình giảm giá không hợp lệ hoặc đã hết hạn.');
        g = { MA_GIAM_GIA: ct.MA_GIAM_GIA, LOAI_GIAM: ct.LOAI_GIAM, GIA_TRI_GIAM: so_(ct.GIA_TRI) };
      } else if (yc && yc.loai) {
        if (yc.loai !== LOAI_GIAM.PHAN_TRAM && yc.loai !== LOAI_GIAM.SO_TIEN) throw new Error('Loại giảm giá không hợp lệ.');
        const gt = so_(yc.giaTri);
        if (gt < 0 || (yc.loai === LOAI_GIAM.PHAN_TRAM && gt > 100)) throw new Error('Giá trị giảm giá không hợp lệ.');
        g = { MA_GIAM_GIA: 'GIAM_TAY', LOAI_GIAM: yc.loai, GIA_TRI_GIAM: gt };
      }
      tinhLaiHoaDon_(maHD, g);
      hd = timHoaDon_(maHD, p);
    }

    const daTra = so_(hd.DA_THANH_TOAN);
    const conLai = so_(hd.TONG_THANH_TOAN) - daTra;
    const ptHopLe = {};
    docBang_('DM_PHUONGTHUCTHANHTOAN').forEach(function (x) { if (x.TRANG_THAI !== TT.NGUNG) ptHopLe[x.MA_PHUONG_THUC] = x; });

    const khoan = (dl.khoanThanhToan || []).filter(function (k) { return so_(k.soTien) > 0; });
    let tongTra = 0;
    khoan.forEach(function (k) {
      if (!ptHopLe[k.maPhuongThuc]) throw new Error('Phương thức thanh toán không hợp lệ.');
      k.soTien = Math.round(so_(k.soTien));
      k.tienKhachDua = Math.round(so_(k.tienKhachDua));
      if (k.tienKhachDua && k.tienKhachDua < k.soTien) throw new Error('Tiền khách đưa ít hơn số tiền thanh toán.');
      tongTra += k.soTien;
    });
    if (tongTra > conLai) throw new Error('Tổng thanh toán ' + tien_(tongTra) + ' vượt quá số còn phải trả ' + tien_(conLai) + '.');
    if (!khoan.length && conLai > 0) throw new Error('Vui lòng nhập số tiền thanh toán.');

    let maKH = hd.MA_KHACH_HANG || '';
    if (dl.khachHang && dl.khachHang.soDienThoai) maKH = timHoacTaoKhach_(dl.khachHang, p);

    let stt = timDong_('BH_THANHTOAN', 'MA_HOA_DON', maHD).length;
    const now = new Date();
    let tienThoi = 0;
    themDong_('BH_THANHTOAN', khoan.map(function (k) {
      stt++;
      const thoi = k.tienKhachDua ? k.tienKhachDua - k.soTien : 0;
      tienThoi += thoi;
      return {
        MA_THANH_TOAN: maHD + '-TT' + stt, MA_HOA_DON: maHD, MA_CHI_NHANH: p.MA_CHI_NHANH, NGAY_THANH_TOAN: now,
        MA_PHUONG_THUC: k.maPhuongThuc, SO_TIEN: k.soTien, TIEN_KHACH_DUA: k.tienKhachDua || k.soTien,
        TIEN_THOI_LAI: thoi, NGUOI_THU: p.MA_NHAN_VIEN, GHI_CHU: ''
      };
    }));

    const daTraMoi = daTra + tongTra;
    const hoanTat = daTraMoi >= so_(hd.TONG_THANH_TOAN);
    const patch = { DA_THANH_TOAN: daTraMoi, MA_KHACH_HANG: maKH, NGAY_CAP_NHAT: now };
    if (hoanTat) patch.TRANG_THAI = TT.HD_DA_THANH_TOAN;
    capNhat_('BH_HOADON', hd._row, patch);
    ghiLichSu_(maHD, hoanTat ? 'Thanh toán' : 'Thanh toán một phần',
      khoan.map(function (k) { return k.maPhuongThuc + ' ' + tien_(k.soTien); }).join(', ') || 'Hóa đơn 0đ', p);

    const kq = chiTietHoaDon_(maHD, p);
    kq.tienThoi = tienThoi;
    kq.hoanTat = hoanTat;
    return kq;
  });
}

/* ============================ PHA CHẾ ============================ */

function layDanhSachPhaChe(token) {
  const p = phien_(token);
  yeuCau_(p, NHOM_QUYEN.PHA_CHE);
  return phaChe_(p).ds;
}

/** Dùng cho thông báo trên quầy pha chế (gọi định kỳ vài giây/lần): món đang chờ + món vừa bị hủy trong ngày. */
function theoDoiPhaChe(token) {
  const p = phien_(token);
  yeuCau_(p, NHOM_QUYEN.PHA_CHE);
  return phaChe_(p);
}

/** Món chờ pha chế quá 1 ngày coi như đã xử lý (quán không dùng màn hình pha chế, hay quên bấm Xong) */
function hanPhaChe_() { const d = ngayThuan_(); d.setDate(d.getDate() - 1); return Utilities.formatDate(d, MUI_GIO, 'yyyy-MM-dd'); }

/** Các dòng món còn "Chờ pha chế" từ hôm qua đến nay; món cũ hơn được tự chuyển "Đã xong" để lần sau không phải đọc lại. */
function monChoPhaChe_() {
  const tatCa = timDong_('BH_CHITIETHOADON', 'TRANG_THAI_PHA_CHE', TT.PC_CHO);
  const han = hanPhaChe_();
  const cu = tatCa.filter(function (c) { return String(c.NGAY_TAO).slice(0, 10) < han; });
  if (cu.length) {
    const lock = LockService.getScriptLock();
    if (lock.tryLock(3000)) {
      try { ghiCot_('BH_CHITIETHOADON', 'TRANG_THAI_PHA_CHE', cu.map(function (c) { return c._row; }), TT.PC_XONG); SpreadsheetApp.flush(); }
      catch (e) { console.error('Dọn món chờ cũ: ' + e); }
      finally { lock.releaseLock(); }
    }
  }
  return tatCa.filter(function (c) { return String(c.NGAY_TAO).slice(0, 10) >= han; });
}

function phaChe_(p, tatCa) {
  if (!tatCa) tatCa = monChoPhaChe_();
  const nay = homNay_();
  const cho = tatCa.filter(function (c) { return c.TRANG_THAI !== TT.CT_DA_HUY; });
  const huy = tatCa.filter(function (c) { return c.TRANG_THAI === TT.CT_DA_HUY && String(c.NGAY_TAO).slice(0, 10) === nay; });
  // Tìm tất cả hóa đơn liên quan trong MỘT lần
  const hdMap = {};
  timNhieuDong_('BH_HOADON', 'MA_HOA_DON', cho.concat(huy).map(function (c) { return c.MA_HOA_DON; })).forEach(function (h) {
    if (h.MA_CHI_NHANH === p.MA_CHI_NHANH) hdMap[h.MA_HOA_DON] = h;
  });
  const banMap = {};
  docBang_('DM_BAN').forEach(function (b) { banMap[b.MA_BAN] = b.TEN_BAN; });
  const nhom = {};
  cho.forEach(function (c) {
    const h = hdMap[c.MA_HOA_DON];
    if (!h || h.TRANG_THAI === TT.HD_DA_HUY) return;
    if (!nhom[h.MA_HOA_DON]) {
      nhom[h.MA_HOA_DON] = { MA_HOA_DON: h.MA_HOA_DON, LOAI_DON: h.LOAI_DON, TEN_BAN: banMap[h.MA_BAN] || '',
        GHI_CHU: h.GHI_CHU || '', DA_THANH_TOAN: h.TRANG_THAI === TT.HD_DA_THANH_TOAN, THOI_GIAN: c.NGAY_TAO, mon: [] };
    }
    nhom[h.MA_HOA_DON].mon.push({ MA_CHI_TIET: c.MA_CHI_TIET, TEN_SAN_PHAM: c.TEN_SAN_PHAM, SO_LUONG: c.SO_LUONG,
      GHI_CHU: c.GHI_CHU || '', NGAY_TAO: c.NGAY_TAO, NGUOI_TAO: c.NGUOI_TAO });
  });
  return {
    ds: Object.keys(nhom).map(function (k) { return nhom[k]; })
      .sort(function (a, b) { return String(a.THOI_GIAN) < String(b.THOI_GIAN) ? -1 : 1; }),
    // Món bị hủy hôm nay khi chưa pha (hủy món, hoặc cả hóa đơn bị hủy): quầy pha chế không cần làm nữa
    huy: huy.concat(cho.filter(function (c) {
      const h = hdMap[c.MA_HOA_DON]; return h && h.TRANG_THAI === TT.HD_DA_HUY && String(c.NGAY_TAO).slice(0, 10) === nay;
    })).filter(function (c) { return hdMap[c.MA_HOA_DON]; }).map(function (c) {
      const h = hdMap[c.MA_HOA_DON];
      return { MA_CHI_TIET: c.MA_CHI_TIET, MA_HOA_DON: c.MA_HOA_DON, TEN_SAN_PHAM: c.TEN_SAN_PHAM, SO_LUONG: c.SO_LUONG,
        LOAI_DON: h.LOAI_DON, TEN_BAN: banMap[h.MA_BAN] || '', HUY_CA_DON: h.TRANG_THAI === TT.HD_DA_HUY };
    })
  };
}

/** Đánh dấu xong: một lần tìm + một lần ghi cho cả đơn, rồi trả danh sách mới từ dữ liệu vừa đọc (không đọc lại). */
function xacNhanPhaChe(token, dsMaCT) {
  const p = phien_(token);
  yeuCau_(p, NHOM_QUYEN.PHA_CHE);
  const can = {};
  (dsMaCT || []).slice(0, 200).forEach(function (m) { can[m] = true; });
  return voiKhoa_(function () {
    const tatCa = monChoPhaChe_();
    const xong = tatCa.filter(function (c) { return can[c.MA_CHI_TIET]; });
    ghiCot_('BH_CHITIETHOADON', 'TRANG_THAI_PHA_CHE', xong.map(function (c) { return c._row; }), TT.PC_XONG);
    return phaChe_(p, tatCa.filter(function (c) { return !can[c.MA_CHI_TIET]; })).ds;
  });
}

/* ============================ HÓA ĐƠN TRONG NGÀY ============================ */

function layHoaDonTrongNgay(token, ngay) {
  const p = phien_(token);
  yeuCau_(p, NHOM_QUYEN.XEM_HOA_DON);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ngay || ''))) ngay = homNay_();
  const xemVon = NHOM_QUYEN.XEM_GIA_VON.indexOf(p.VAI_TRO) >= 0;
  const banMap = {};
  docBang_('DM_BAN').forEach(function (b) { banMap[b.MA_BAN] = b.TEN_BAN; });

  const ds = docDongLoc_('BH_HOADON', 'NGAY_BAN', function (v) { return String(v).slice(0, 10) === ngay; }, ngayTruoc_(ngay))
    .filter(function (h) { return h.MA_CHI_NHANH === p.MA_CHI_NHANH; });
  const ma = {};
  ds.forEach(function (h) { ma[h.MA_HOA_DON] = true; });

  const th = { soHoaDon: ds.length, daThanhToan: 0, dangPhucVu: 0, daHuy: 0, tongTienHang: 0, giamGia: 0, doanhThu: 0, giaVon: 0 };
  ds.forEach(function (h) {
    if (h.TRANG_THAI === TT.HD_DA_THANH_TOAN) {
      th.daThanhToan++; th.tongTienHang += so_(h.TONG_TIEN_HANG); th.giamGia += so_(h.TIEN_GIAM_GIA);
      th.doanhThu += so_(h.TONG_THANH_TOAN); th.giaVon += so_(h.TONG_GIA_VON);
    } else if (h.TRANG_THAI === TT.HD_DANG_PHUC_VU) th.dangPhucVu++;
    else if (h.TRANG_THAI === TT.HD_DA_HUY) th.daHuy++;
  });
  if (xemVon) th.laiGop = th.doanhThu - th.giaVon; else delete th.giaVon;

  const ptTen = {};
  docBang_('DM_PHUONGTHUCTHANHTOAN').forEach(function (x) { ptTen[x.MA_PHUONG_THUC] = x.TEN_PHUONG_THUC; });
  const theoPT = {};
  docDongLoc_('BH_THANHTOAN', 'MA_HOA_DON', function (v) { return ma[v]; }, hdTruocNgay_(ngay)).forEach(function (t) {
    const k = t.MA_PHUONG_THUC;
    if (!theoPT[k]) theoPT[k] = { MA_PHUONG_THUC: k, TEN_PHUONG_THUC: ptTen[k] || k, SO_TIEN: 0, SO_LAN: 0 };
    theoPT[k].SO_TIEN += so_(t.SO_TIEN); theoPT[k].SO_LAN++;
  });

  return {
    ngay: ngay, tongHop: th,
    theoPhuongThuc: Object.keys(theoPT).map(function (k) { return theoPT[k]; }),
    hoaDon: ds.sort(function (a, b) { return String(a.NGAY_TAO) < String(b.NGAY_TAO) ? 1 : -1; }).map(function (h) {
      return { MA_HOA_DON: h.MA_HOA_DON, GIO_BAN: h.GIO_BAN, LOAI_DON: h.LOAI_DON, TEN_BAN: banMap[h.MA_BAN] || '',
        MA_NHAN_VIEN: h.MA_NHAN_VIEN, TONG_THANH_TOAN: so_(h.TONG_THANH_TOAN), DA_THANH_TOAN: so_(h.DA_THANH_TOAN),
        TRANG_THAI: h.TRANG_THAI };
    })
  };
}

/* ======================= KHỞI TẠO HỆ THỐNG ======================= */

function khoiTaoHeThong() {
  _DA_TU_SUA = true;
  const msg = capNhatCauTruc_();
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

/** Chẩn đoán khi Web App báo thiếu bảng: chạy hàm này trong Apps Script rồi xem thông báo. */
function kiemTraHeThong() {
  const dong = [];
  let act = null;
  try { act = SpreadsheetApp.getActive(); } catch (e) { /* bỏ qua */ }
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  dong.push('1. File gắn với Apps Script: ' + (act ? '"' + act.getName() + '"' : 'KHÔNG CÓ (script chưa gắn với Google Sheet)'));
  let f = null;
  if (id) {
    try { f = SpreadsheetApp.openById(id); dong.push('2. File dữ liệu Web App đang dùng: "' + f.getName() + '"'); }
    catch (e) { dong.push('2. File dữ liệu (SPREADSHEET_ID) KHÔNG MỞ ĐƯỢC: ' + e.message); }
  } else dong.push('2. Chưa lưu file dữ liệu (chưa từng chạy khoiTaoHeThong)');
  if (act && f && act.getId() !== f.getId()) dong.push('⚠ Hai file KHÁC NHAU. Chạy khoiTaoHeThong để Web App dùng file đang mở.');
  const ss = f || act;
  if (ss) {
    const thieu = Object.keys(CAU_TRUC).filter(function (t) { return !ss.getSheetByName(t); });
    dong.push('3. ' + (thieu.length ? 'Bảng còn thiếu: ' + thieu.join(', ') : 'Đủ ' + Object.keys(CAU_TRUC).length + ' bảng.'));
  }
  dong.push('4. File QuanTri.gs: ' + (typeof layThongTinCongKhai === 'function' && typeof dangNhap === 'function' ? 'có' : 'THIẾU – hãy thêm file QuanTri.gs'));
  const msg = dong.join('\n');
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert('Kiểm tra hệ thống', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* chạy ngoài Sheet */ }
  return msg;
}

/** Tạo bảng/cột còn thiếu, nạp dữ liệu mẫu cho bảng trống. Chạy lại nhiều lần không mất dữ liệu. */
function capNhatCauTruc_() {
  xoaBoNhoTam_();
  try { CacheService.getScriptCache().remove('TTQ'); } catch (e) { /* bỏ qua */ }
  let ss = null;
  try { ss = SpreadsheetApp.getActive(); } catch (e) { /* chạy từ Web App */ }
  if (ss) { PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId()); _SS = ss; }
  else ss = ss_();
  if (!ss) throw new Error('Không xác định được Google Sheet. Hãy mở Apps Script từ Sheet và chạy "khoiTaoHeThong".');
  ss.setSpreadsheetTimeZone(MUI_GIO);

  const mauTab = { DM: '#2E7D5B', BH: '#6F4E37', NS: '#3D6FB6', HT: '#9E9E9E' };
  const moi = [];
  Object.keys(CAU_TRUC).forEach(function (ten) {
    const kq = layHoacTaoBang_(ss, ten);
    const sh = kq.sh;
    if (kq.moi) moi.push(ten);
    const cot = CAU_TRUC[ten];
    const hienCo = sh.getLastColumn() > 0
      ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String).filter(String) : [];
    const thieu = cot.filter(function (c) { return hienCo.indexOf(c) < 0; });
    if (thieu.length) sh.getRange(1, hienCo.length + 1, 1, thieu.length).setValues([thieu]);
    delete _TIEU_DE[ten];
    const td = tieuDe_(ten);
    sh.getRange(1, 1, 1, td.length).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#6F4E37');
    sh.setFrozenRows(1);
    sh.setTabColor(mauTab[ten.split('_')[0]] || '#9E9E9E');

    const soDong = Math.max(1, sh.getMaxRows() - 1);
    td.forEach(function (h, j) {
      const vung = sh.getRange(2, j + 1, soDong, 1);
      if (COT_VAN_BAN.indexOf(h) >= 0) vung.setNumberFormat('@');
      else if (COT_TIEN.indexOf(h) >= 0) vung.setNumberFormat('#,##0');
      else if (COT_NGAY.indexOf(h) >= 0) vung.setNumberFormat('dd/MM/yyyy');
      else if (COT_THOI_GIAN.indexOf(h) >= 0) vung.setNumberFormat('dd/MM/yyyy HH:mm:ss');
    });
  });

  const soChuyenDoi = chuyenDoiTaiKhoan_();
  napDuLieuMau_();
  datRangBuoc_();

  // Bảng giao dịch: cảnh báo khi sửa tay
  Object.keys(CAU_TRUC).forEach(function (ten) {
    if (!/^(BH_(HOADON|CHITIETHOADON|THANHTOAN|LICHSUHANG|YEUCAU)|NS_TAIKHOAN|HT_BODEM)/.test(ten)) return;
    const sh = ss.getSheetByName(ten);
    if (!sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length) {
      sh.protect().setDescription('Dữ liệu giao dịch – không sửa tay').setWarningOnly(true);
    }
  });

  ['Sheet1', 'Trang tính1'].forEach(function (t) {
    const sh = ss.getSheetByName(t);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  const msg = 'File "' + ss.getName() + '": đã khởi tạo cấu trúc ' + Object.keys(CAU_TRUC).length + ' bảng' +
    (moi.length ? ' (tạo mới ' + moi.length + ' bảng)' : '') + '.' +
    (soChuyenDoi ? '\nĐã chuyển ' + soChuyenDoi + ' mã PIN cũ thành tài khoản: tên đăng nhập = mã nhân viên viết thường, mật khẩu = PIN cũ (bắt buộc đổi khi đăng nhập).' : '');
  return msg;
}

function datRangBuoc_() {
  const ss = ss_();
  const vung = function (ten, cot) {
    const sh = ss.getSheetByName(ten);
    const j = tieuDe_(ten).indexOf(cot) + 1;
    return sh.getRange(2, j, Math.max(1, sh.getMaxRows() - 1), 1);
  };
  const dat = function (ten, cot, nguon) {
    if (tieuDe_(ten).indexOf(cot) < 0) return;
    const b = SpreadsheetApp.newDataValidation();
    (Array.isArray(nguon) ? b.requireValueInList(nguon, true) : b.requireValueInRange(nguon, true));
    vung(ten, cot).setDataValidation(b.setAllowInvalid(false).build());
  };
  const hd = [TT.HOAT_DONG, TT.NGUNG];
  dat('DM_CHINHANH', 'TRANG_THAI', hd);
  dat('DM_NHOMSANPHAM', 'TRANG_THAI', hd);
  dat('DM_SANPHAM', 'TRANG_THAI', [TT.DANG_BAN, TT.NGUNG_BAN]);
  dat('DM_SANPHAM', 'MA_NHOM_SAN_PHAM', vung('DM_NHOMSANPHAM', 'MA_NHOM_SAN_PHAM'));
  dat('DM_SANPHAM', 'DON_VI_TINH', vung('DM_DONVITINH', 'TEN_DON_VI_TINH'));
  dat('DM_KHUVUC', 'MA_CHI_NHANH', vung('DM_CHINHANH', 'MA_CHI_NHANH'));
  dat('DM_KHUVUC', 'TRANG_THAI', hd);
  dat('DM_BAN', 'MA_CHI_NHANH', vung('DM_CHINHANH', 'MA_CHI_NHANH'));
  dat('DM_BAN', 'MA_KHU_VUC', vung('DM_KHUVUC', 'MA_KHU_VUC'));
  dat('DM_BAN', 'TRANG_THAI', hd);
  dat('DM_NHANVIEN', 'VAI_TRO', [VT.CHU_QUAN, VT.QUAN_LY, VT.THU_NGAN, VT.PHA_CHE, VT.PHUC_VU]);
  dat('DM_NHANVIEN', 'TRANG_THAI', [TT.DANG_LAM, TT.NGHI_VIEC]);
  dat('DM_PHUONGTHUCTHANHTOAN', 'TRANG_THAI', hd);
  dat('BH_GIAMGIA', 'LOAI_GIAM', [LOAI_GIAM.PHAN_TRAM, LOAI_GIAM.SO_TIEN]);
  dat('BH_GIAMGIA', 'TRANG_THAI', hd);
  dat('NS_TAIKHOAN', 'TRANG_THAI', ['Hoạt động', 'Đã khóa']);
  dat('NS_TAIKHOAN', 'MA_NHAN_VIEN', vung('DM_NHANVIEN', 'MA_NHAN_VIEN'));
  vung('NS_TAIKHOAN', 'DOI_MAT_KHAU').setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
}

function napDuLieuMau_() {
  const trong = function (ten) { return sheet_(ten).getLastRow() < 2; };
  const nap = function (ten, cot, dong) {
    if (!trong(ten)) return;
    themDong_(ten, dong.map(function (d) { const o = {}; cot.forEach(function (c, i) { o[c] = d[i]; }); return o; }));
  };
  const H = TT.HOAT_DONG;

  nap('DM_CHINHANH', ['MA_CHI_NHANH', 'TEN_CHI_NHANH', 'DIA_CHI', 'SO_DIEN_THOAI', 'TRANG_THAI'], [
    ['CN01', 'Cafe – Chi nhánh 1', '123 Đường A, Quận 1', '0900000001', H],
    ['CN02', 'Cafe – Chi nhánh 2', '456 Đường B, Quận 3', '0900000002', H]
  ]);
  nap('DM_DONVITINH', ['MA_DON_VI_TINH', 'TEN_DON_VI_TINH'], [
    ['LY', 'Ly'], ['CHAI', 'Chai'], ['CAI', 'Cái'], ['PHAN', 'Phần'], ['KG', 'kg'], ['G', 'g'], ['LIT', 'lít'], ['ML', 'ml']
  ]);
  nap('DM_NHOMSANPHAM', ['MA_NHOM_SAN_PHAM', 'TEN_NHOM_SAN_PHAM', 'THU_TU', 'TRANG_THAI'], [
    ['CAPHE', 'Cà phê', 1, H], ['TRA', 'Trà', 2, H], ['NUOCEP', 'Nước ép – Sinh tố', 3, H], ['BANH', 'Bánh', 4, H]
  ]);
  const B = TT.DANG_BAN;
  nap('DM_SANPHAM', ['MA_SAN_PHAM', 'TEN_SAN_PHAM', 'MA_NHOM_SAN_PHAM', 'DON_VI_TINH', 'GIA_BAN', 'GIA_VON', 'HINH_ANH', 'THU_TU', 'TRANG_THAI', 'GHI_CHU'], [
    ['SP001', 'Cà phê đen đá', 'CAPHE', 'Ly', 25000, 7000, '', 1, B, ''],
    ['SP002', 'Cà phê sữa đá', 'CAPHE', 'Ly', 29000, 9000, '', 2, B, ''],
    ['SP003', 'Bạc xỉu', 'CAPHE', 'Ly', 32000, 10000, '', 3, B, ''],
    ['SP004', 'Cappuccino', 'CAPHE', 'Ly', 45000, 14000, '', 4, B, ''],
    ['SP005', 'Trà đào cam sả', 'TRA', 'Ly', 39000, 11000, '', 5, B, ''],
    ['SP006', 'Trà sen vàng', 'TRA', 'Ly', 42000, 12000, '', 6, B, ''],
    ['SP007', 'Nước cam ép', 'NUOCEP', 'Ly', 35000, 13000, '', 7, B, ''],
    ['SP008', 'Sinh tố bơ', 'NUOCEP', 'Ly', 45000, 16000, '', 8, B, ''],
    ['SP009', 'Bánh croissant', 'BANH', 'Cái', 30000, 15000, '', 9, B, ''],
    ['SP010', 'Bánh tiramisu', 'BANH', 'Cái', 38000, 17000, '', 10, B, '']
  ]);
  nap('DM_KHUVUC', ['MA_KHU_VUC', 'MA_CHI_NHANH', 'TEN_KHU_VUC', 'THU_TU', 'TRANG_THAI'], [
    ['CN01-TN', 'CN01', 'Trong nhà', 1, H], ['CN01-SV', 'CN01', 'Sân vườn', 2, H], ['CN02-T1', 'CN02', 'Tầng 1', 1, H]
  ]);
  const ban = [];
  for (let i = 1; i <= 6; i++) ban.push(['CN01-B' + dem_(i, 2), 'CN01', i <= 4 ? 'CN01-TN' : 'CN01-SV', 'Bàn ' + dem_(i, 2), 4, i, H]);
  for (let i = 1; i <= 4; i++) ban.push(['CN02-B' + dem_(i, 2), 'CN02', 'CN02-T1', 'Bàn ' + dem_(i, 2), 4, i, H]);
  nap('DM_BAN', ['MA_BAN', 'MA_CHI_NHANH', 'MA_KHU_VUC', 'TEN_BAN', 'SO_CHO', 'THU_TU', 'TRANG_THAI'], ban);
  const L = TT.DANG_LAM;
  const NVL = ngayThuan_();
  nap('DM_NHANVIEN', ['MA_NHAN_VIEN', 'TEN_NHAN_VIEN', 'MA_CHI_NHANH', 'VAI_TRO', 'SO_DIEN_THOAI', 'NGAY_VAO_LAM', 'TRANG_THAI', 'GHI_CHU'], [
    ['NV001', 'Chủ quán', '*', VT.CHU_QUAN, '', NVL, L, 'Dấu * = mọi chi nhánh'],
    ['NV002', 'Thu ngân CN1', 'CN01', VT.THU_NGAN, '', NVL, L, ''],
    ['NV003', 'Pha chế CN1', 'CN01', VT.PHA_CHE, '', NVL, L, ''],
    ['NV004', 'Phục vụ CN1', 'CN01', VT.PHUC_VU, '', NVL, L, ''],
    ['NV005', 'Quản lý CN2', 'CN02', VT.QUAN_LY, '', NVL, L, '']
  ]);
  nap('DM_PHUONGTHUCTHANHTOAN', ['MA_PHUONG_THUC', 'TEN_PHUONG_THUC', 'THU_TU', 'TRANG_THAI'], [
    ['TM', 'Tiền mặt', 1, H], ['CK', 'Chuyển khoản', 2, H], ['VDT', 'Ví điện tử', 3, H]
  ]);
  const nay = ngayThuan_();
  const sau30 = new Date(nay.getFullYear(), nay.getMonth(), nay.getDate() + 30);
  nap('BH_GIAMGIA', ['MA_GIAM_GIA', 'TEN_CHUONG_TRINH', 'LOAI_GIAM', 'GIA_TRI', 'MA_CHI_NHANH', 'NGAY_BAT_DAU', 'NGAY_KET_THUC', 'TRANG_THAI'], [
    ['GG10', 'Giảm 10% khai trương', LOAI_GIAM.PHAN_TRAM, 10, '', nay, sau30, H],
    ['GG20K', 'Giảm 20.000đ', LOAI_GIAM.SO_TIEN, 20000, 'CN01', '', '', H]
  ]);
  napTaiKhoanMau_();
  napThongTinQuan_();
}
