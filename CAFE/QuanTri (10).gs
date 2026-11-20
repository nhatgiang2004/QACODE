/***********************************************************************
 * TÀI KHOẢN · PHIÊN ĐĂNG NHẬP · QUẢN TRỊ
 * - NS_TAIKHOAN: tên đăng nhập + mật khẩu (băm có muối, không lưu mật khẩu gốc)
 * - Phiên thường: 6 giờ (CacheService). "Ghi nhớ đăng nhập": 30 ngày (ScriptProperties)
 * - HT_THONGTINQUAN: thông tin chung của quán (in trên hóa đơn, màn hình đăng nhập)
 * - Phân quyền vẫn theo VAI_TRO của nhân viên (DM_NHANVIEN)
 ***********************************************************************/

const THOI_HAN_GHI_NHO = 30 * 24 * 3600 * 1000; // 30 ngày
const KIEM_TRA_LAI_SAU = 10 * 60 * 1000;         // đối chiếu lại tài khoản mỗi 10 phút
const TT_TK = { HOAT_DONG: 'Hoạt động', KHOA: 'Đã khóa' };
const VAI_TRO_QL_DUOC_GAN = ['Thu ngân', 'Pha chế', 'Phục vụ']; // không tham chiếu VT: thứ tự nạp file không cố định
const MAT_KHAU_MAU = '123456';

const THONG_TIN_QUAN = [
  ['TEN_QUAN', 'Tên quán', 'Cafe Của Tôi'],
  ['SLOGAN', 'Khẩu hiệu', ''],
  ['LOGO', 'Link ảnh logo (https://…)', ''],
  ['ANH_CUA_HANG', 'Ảnh cửa hàng (màn hình chính)', ''],
  ['SO_DIEN_THOAI', 'Hotline', ''],
  ['EMAIL', 'Email', ''],
  ['WEBSITE', 'Website / Fanpage', ''],
  ['MA_SO_THUE', 'Mã số thuế', ''],
  ['NGAN_HANG', 'Ngân hàng nhận chuyển khoản', ''],
  ['MA_NGAN_HANG', 'Mã BIN ngân hàng (VietQR)', ''],
  ['SO_TAI_KHOAN', 'Số tài khoản', ''],
  ['CHU_TAI_KHOAN', 'Chủ tài khoản', ''],
  ['IN_QR_HOA_DON', 'In mã QR trên hóa đơn', 'Tất cả hóa đơn'],
  ['WIFI', 'Wifi (tên / mật khẩu)', ''],
  ['GOI_MON_KHACH', 'Khách gọi món qua mã QR', 'Nhân viên xác nhận'],
  ['LINK_GOI_MON', 'Link trang gọi món của khách (GitHub Pages)', ''],
  ['LOI_CHAO_HOA_DON', 'Lời chào cuối hóa đơn', 'Cảm ơn quý khách – Hẹn gặp lại!']
];

/* ============================ THÔNG TIN QUÁN ============================ */

function docThongTinQuan_() {
  const kq = {};
  THONG_TIN_QUAN.forEach(function (t) { kq[t[0]] = t[2]; });
  docBang_('HT_THONGTINQUAN').forEach(function (r) { if (r.KHOA) kq[r.KHOA] = String(r.NOI_DUNG == null ? '' : r.NOI_DUNG); });
  return kq;
}

/** Đọc thông tin quán; lỗi (ví dụ thiếu bảng) thì dùng giá trị mặc định để không chặn bán hàng. */
function thongTinQuanAnToan_() {
  const dem = docDem_('TTQ');
  if (dem) return dem;
  try { const q = docThongTinQuan_(); ghiDem_('TTQ', q, 600); return q; }
  catch (e) {
    console.error('thongTinQuanAnToan_: ' + e);
    const q = {};
    THONG_TIN_QUAN.forEach(function (t) { q[t[0]] = t[2]; });
    return q;
  }
}

/** Dùng cho màn hình đăng nhập (không cần đăng nhập). */
function layThongTinCongKhai() {
  let q;
  try { q = docThongTinQuan_(); }
  catch (e) { console.error('layThongTinCongKhai: ' + e); q = {}; THONG_TIN_QUAN.forEach(function (t) { q[t[0]] = t[2]; }); }
  return { TEN_QUAN: q.TEN_QUAN, SLOGAN: q.SLOGAN, LOGO: q.LOGO, PHIEN_BAN: typeof PHIEN_BAN_UNG_DUNG === 'string' ? PHIEN_BAN_UNG_DUNG : '' };
}

function luuThongTinQuan(token, dl) {
  const p = phien_(token, { khongCanChiNhanh: true });
  yeuCau_(p, [VT.CHU_QUAN]);
  dl = dl || {};
  if (!String(dl.TEN_QUAN || '').trim()) throw new Error('Vui lòng nhập tên quán.');
  if (dl.LOGO) {
    const lg = chuanHoaLinkAnh_(dl.LOGO);
    dl.LOGO = lg.anh ? luuAnhDrive_(lg.anh, 'logo') : lg.link;
  }
  // Ảnh cửa hàng: tải ảnh mới lên Drive hoặc dùng link; ảnh Drive cũ được chuyển vào thùng rác
  const anhCHCu = ('ANH_CUA_HANG' in dl || dl.anhCuaHangMoi) ? (thongTinQuanAnToan_().ANH_CUA_HANG || '') : null;
  if (dl.anhCuaHangMoi && dl.anhCuaHangMoi.base64) {
    dl.ANH_CUA_HANG = luuAnhDrive_(dl.anhCuaHangMoi, 'cua_hang');
  } else if ('ANH_CUA_HANG' in dl) {
    const ch = chuanHoaLinkAnh_(dl.ANH_CUA_HANG);
    dl.ANH_CUA_HANG = ch.anh ? luuAnhDrive_(ch.anh, 'cua_hang') : ch.link;
  }
  delete dl.anhCuaHangMoi;
  if (dl.MA_NGAN_HANG && !/^\d{6}$/.test(String(dl.MA_NGAN_HANG).trim())) throw new Error('Mã BIN ngân hàng gồm đúng 6 chữ số.');
  if (dl.SO_TAI_KHOAN) {
    dl.SO_TAI_KHOAN = String(dl.SO_TAI_KHOAN).replace(/\s/g, '');
    if (!/^[A-Za-z0-9]{4,19}$/.test(dl.SO_TAI_KHOAN)) throw new Error('Số tài khoản chỉ gồm chữ và số, 4–19 ký tự.');
  }
  if ('GOI_MON_KHACH' in dl && ['Nhân viên xác nhận', 'Gửi thẳng quầy pha chế', 'Tắt'].indexOf(dl.GOI_MON_KHACH) < 0) dl.GOI_MON_KHACH = 'Nhân viên xác nhận';
  if (dl.LINK_GOI_MON) {
    dl.LINK_GOI_MON = String(dl.LINK_GOI_MON).trim().replace(/^http:\/\//i, 'https://');
    if (!/^https:\/\//i.test(dl.LINK_GOI_MON)) dl.LINK_GOI_MON = 'https://' + dl.LINK_GOI_MON;
    if (/script\.google(usercontent)?\.com/i.test(dl.LINK_GOI_MON)) throw new Error('Link trang gọi món phải là trang GitHub Pages (…github.io), không phải link Apps Script.');
  }
  if (dl.SO_TAI_KHOAN && !dl.MA_NGAN_HANG) throw new Error('Vui lòng chọn ngân hàng cho số tài khoản.');
  const kq = voiKhoa_(function () {
    const ds = docBang_('HT_THONGTINQUAN');
    const them = [];
    THONG_TIN_QUAN.forEach(function (t) {
      if (!(t[0] in dl)) return;
      const v = String(dl[t[0]] == null ? '' : dl[t[0]]).trim().slice(0, /^(LOGO|ANH_CUA_HANG)$/.test(t[0]) ? 1500 : 300);
      const r = ds.filter(function (x) { return x.KHOA === t[0]; })[0];
      if (r) capNhat_('HT_THONGTINQUAN', r._row, { NOI_DUNG: v, TEN_TRUONG: t[1] });
      else them.push({ KHOA: t[0], TEN_TRUONG: t[1], NOI_DUNG: v });
    });
    themDong_('HT_THONGTINQUAN', them);
    return docThongTinQuan_();
  });
  if (anhCHCu && anhCHCu !== dl.ANH_CUA_HANG) xoaAnhDrive_(anhCHCu);
  return kq;
}

/* ============================ MẬT KHẨU ============================ */

function hex_(b) { return b.map(function (x) { return ((x + 256) % 256).toString(16).padStart(2, '0'); }).join(''); }

/** Mã PIN cũ (giai đoạn 1) – chỉ dùng để chuyển đổi. */
function bamCu_(maNV, pin) {
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'cafe|' + maNV + '|' + pin, Utilities.Charset.UTF_8));
}

function bamMK_(muoi, mk) {
  let h = muoi + '|' + mk;
  for (let i = 0; i < 200; i++) {
    h = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + '|' + muoi, Utilities.Charset.UTF_8));
  }
  return h;
}

function patchMK_(mk) {
  const muoi = Utilities.getUuid().replace(/-/g, '');
  return { MAT_KHAU: bamMK_(muoi, mk), MUOI: muoi };
}

/** Trả về {ok, nangCap}. nangCap = cần băm lại theo chuẩn mới. */
function kiemTraMK_(tk, mk) {
  const luu = String(tk.MAT_KHAU == null ? '' : tk.MAT_KHAU);
  const muoi = String(tk.MUOI || '');
  if (!mk || !luu) return { ok: false };
  if (muoi.indexOf('LEGACY:') === 0) return { ok: luu === bamCu_(muoi.slice(7), mk), nangCap: true };
  if (muoi) return { ok: luu === bamMK_(muoi, mk) };
  // Mật khẩu gõ tay vào Sheet (chưa băm) – dùng khi cần cứu hộ tài khoản
  return { ok: luu === mk, nangCap: true };
}

function kiemTraDoManh_(mk) {
  mk = String(mk || '');
  if (mk.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
  if (mk.length > 64) throw new Error('Mật khẩu tối đa 64 ký tự.');
  if (/^\s|\s$/.test(mk)) throw new Error('Mật khẩu không được bắt đầu hoặc kết thúc bằng khoảng trắng.');
}

function laTrue_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }

/* ============================ PHIÊN ĐĂNG NHẬP ============================ */

function dsChiNhanhHoatDong_() {
  return docBang_('DM_CHINHANH').filter(function (c) { return c.TRANG_THAI !== TT.NGUNG; })
    .map(function (c) { return { MA_CHI_NHANH: c.MA_CHI_NHANH, TEN_CHI_NHANH: c.TEN_CHI_NHANH, DIA_CHI: c.DIA_CHI || '' }; });
}

function phienTuTaiKhoan_(tk, cn) {
  const nv = docBang_('DM_NHANVIEN').filter(function (x) { return x.MA_NHAN_VIEN === tk.MA_NHAN_VIEN; })[0];
  if (!nv || nv.TRANG_THAI === TT.NGHI_VIEC) throw new Error('Tài khoản chưa gắn với nhân viên đang làm việc.');
  const nhieu = nv.MA_CHI_NHANH === '*' || nv.VAI_TRO === VT.CHU_QUAN;
  const dsCN = docBang_('DM_CHINHANH').filter(function (c) { return c.TRANG_THAI !== TT.NGUNG; });
  if (!nhieu) cn = nv.MA_CHI_NHANH;
  let c = dsCN.filter(function (x) { return x.MA_CHI_NHANH === cn; })[0];
  if (!c && nhieu && dsCN.length === 1) c = dsCN[0];
  if (!c && !nhieu) throw new Error('Chi nhánh của nhân viên không tồn tại hoặc đã ngừng hoạt động.');
  return {
    MA_TAI_KHOAN: tk.MA_TAI_KHOAN, TEN_DANG_NHAP: tk.TEN_DANG_NHAP,
    MA_NHAN_VIEN: nv.MA_NHAN_VIEN, TEN_NHAN_VIEN: nv.TEN_NHAN_VIEN, VAI_TRO: nv.VAI_TRO,
    NHIEU_CHI_NHANH: nhieu,
    MA_CHI_NHANH: c ? c.MA_CHI_NHANH : '', TEN_CHI_NHANH: c ? c.TEN_CHI_NHANH : '',
    DIA_CHI: c ? (c.DIA_CHI || '') : '', SO_DIEN_THOAI: c ? (c.SO_DIEN_THOAI || '') : '',
    DOI_MAT_KHAU: laTrue_(tk.DOI_MAT_KHAU), v: so_(tk.PHIEN_BAN), _kt: Date.now()
  };
}

function taoPhien_(maTK, cn) {
  const tk = docBang_('NS_TAIKHOAN').filter(function (x) { return x.MA_TAI_KHOAN === maTK; })[0];
  if (!tk || tk.TRANG_THAI !== TT_TK.HOAT_DONG) throw new Error('PHIEN_HET_HAN');
  try { return phienTuTaiKhoan_(tk, cn); } catch (e) { throw new Error('PHIEN_HET_HAN'); }
}

function luuPhien_(token, p, ghiBen) {
  CacheService.getScriptCache().put('S_' + token, JSON.stringify(p), THOI_HAN_PHIEN);
  if (ghiBen && p.ghiNho) {
    PropertiesService.getScriptProperties().setProperty('P_' + token,
      JSON.stringify({ tk: p.MA_TAI_KHOAN, cn: p.MA_CHI_NHANH || '', v: p.v, het: p.het }));
  }
}

function huyPhien_(token) {
  CacheService.getScriptCache().remove('S_' + token);
  PropertiesService.getScriptProperties().deleteProperty('P_' + token);
}

/**
 * Kiểm tra phiên. tuyChon:
 *  - khongCanChiNhanh: cho phép khi chủ quán chưa chọn chi nhánh
 *  - choPhepDoiMK: cho phép khi tài khoản đang bị yêu cầu đổi mật khẩu
 */
function phien_(token, tuyChon) {
  tuyChon = tuyChon || {};
  if (!token) throw new Error('PHIEN_HET_HAN');
  const cache = CacheService.getScriptCache();
  let p;
  const s = cache.get('S_' + token);
  if (s) {
    p = JSON.parse(s);
  } else {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty('P_' + token);
    if (!raw) throw new Error('PHIEN_HET_HAN');
    const r = JSON.parse(raw);
    if (r.het < Date.now()) { props.deleteProperty('P_' + token); throw new Error('PHIEN_HET_HAN'); }
    try { p = taoPhien_(r.tk, r.cn); } catch (e) { props.deleteProperty('P_' + token); throw e; }
    if (String(p.v) !== String(r.v)) { props.deleteProperty('P_' + token); throw new Error('PHIEN_HET_HAN'); }
    p.ghiNho = true; p.het = r.het;
  }
  const v = cache.get('TKV_' + p.MA_TAI_KHOAN);
  if (v !== null && String(v) !== String(p.v)) { huyPhien_(token); throw new Error('PHIEN_HET_HAN'); }
  if (Date.now() - (p._kt || 0) > KIEM_TRA_LAI_SAU) {
    let moi;
    try { moi = taoPhien_(p.MA_TAI_KHOAN, p.MA_CHI_NHANH); } catch (e) { huyPhien_(token); throw e; }
    if (String(moi.v) !== String(p.v)) { huyPhien_(token); throw new Error('PHIEN_HET_HAN'); }
    moi.ghiNho = p.ghiNho; moi.het = p.het;
    p = moi;
  }
  luuPhien_(token, p, false);
  if (p.DOI_MAT_KHAU && !tuyChon.choPhepDoiMK) throw new Error('CAN_DOI_MAT_KHAU');
  if (!p.MA_CHI_NHANH && !tuyChon.khongCanChiNhanh) throw new Error('CHUA_CHON_CHI_NHANH');
  return p;
}

function yeuCau_(p, ds) {
  if (ds.indexOf(p.VAI_TRO) < 0) throw new Error('Bạn không có quyền thực hiện thao tác này (' + p.VAI_TRO + ').');
}

function congKhai_(p) {
  const r = {};
  Object.keys(p).forEach(function (k) { if (k !== '_kt' && k !== 'v') r[k] = p[k]; });
  return r;
}

function ketQuaPhien_(p) {
  const kq = { phien: congKhai_(p), chiNhanh: p.NHIEU_CHI_NHANH ? dsChiNhanhHoatDong_() : null };
  if (p.MA_CHI_NHANH && !p.DOI_MAT_KHAU) kq.duLieu = duLieuKhoiTao_(p); // tiết kiệm một lượt gọi máy chủ
  return kq;
}

function donDepPhien_() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const nay = Date.now();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('P_') !== 0) return;
    try { if (JSON.parse(all[k]).het < nay) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

/** Hủy mọi phiên của tài khoản (trừ phiên giuToken) và tăng PHIEN_BAN. */
function tangPhienBan_(tk, giuToken) {
  const v = so_(tk.PHIEN_BAN) + 1;
  capNhat_('NS_TAIKHOAN', tk._row, { PHIEN_BAN: v });
  CacheService.getScriptCache().put('TKV_' + tk.MA_TAI_KHOAN, String(v), THOI_HAN_PHIEN);
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('P_') !== 0 || k === 'P_' + giuToken) return;
    try { if (JSON.parse(all[k]).tk === tk.MA_TAI_KHOAN) props.deleteProperty(k); } catch (e) { /* bỏ qua */ }
  });
  return v;
}

/* ============================ ĐĂNG NHẬP / ĐĂNG XUẤT ============================ */

function dangNhap(tenDangNhap, matKhau, ghiNho, cnGoiY) {
  const ten = String(tenDangNhap || '').trim().toLowerCase();
  matKhau = String(matKhau || '');
  if (!ten || !matKhau) throw new Error('Vui lòng nhập tên đăng nhập và mật khẩu.');
  const cache = CacheService.getScriptCache();
  const khoaSai = 'SAI_' + ten;
  const soLanSai = Number(cache.get(khoaSai)) || 0;
  if (soLanSai >= 5) throw new Error('Nhập sai quá 5 lần. Vui lòng thử lại sau 5 phút.');
  const loi = function () {
    cache.put(khoaSai, String(soLanSai + 1), 300);
    return new Error('Tên đăng nhập hoặc mật khẩu không đúng.' + (soLanSai >= 2 ? ' Còn ' + (4 - soLanSai) + ' lần thử.' : ''));
  };

  const tk = docBang_('NS_TAIKHOAN').filter(function (x) { return String(x.TEN_DANG_NHAP).toLowerCase() === ten; })[0];
  if (!tk) throw loi();
  const kt = kiemTraMK_(tk, matKhau);
  if (!kt.ok) throw loi();
  if (tk.TRANG_THAI !== TT_TK.HOAT_DONG) throw new Error('Tài khoản đã bị khóa. Vui lòng liên hệ quản lý.');
  cache.remove(khoaSai);

  const p = phienTuTaiKhoan_(tk, cnGoiY);
  const patch = { LAN_DANG_NHAP_CUOI: new Date() };
  if (kt.nangCap) Object.assign(patch, patchMK_(matKhau));
  capNhat_('NS_TAIKHOAN', tk._row, patch);

  p.ghiNho = !!ghiNho;
  if (p.ghiNho) p.het = Date.now() + THOI_HAN_GHI_NHO;
  const token = Utilities.getUuid();
  luuPhien_(token, p, true);
  try { donDepPhien_(); } catch (e) { /* không ảnh hưởng đăng nhập */ }
  const kq = ketQuaPhien_(p);
  kq.token = token;
  return kq;
}

/** Khôi phục phiên khi mở lại ứng dụng (đã ghi nhớ đăng nhập). */
function layPhienHienTai(token) {
  return ketQuaPhien_(phien_(token, { khongCanChiNhanh: true, choPhepDoiMK: true }));
}

function dangXuat(token) {
  if (token) huyPhien_(token);
  return true;
}

function doiChiNhanh(token, maCN) {
  const p = phien_(token, { khongCanChiNhanh: true });
  if (!p.NHIEU_CHI_NHANH) throw new Error('Tài khoản chỉ làm việc tại một chi nhánh.');
  const c = dsChiNhanhHoatDong_().filter(function (x) { return x.MA_CHI_NHANH === maCN; })[0];
  const full = docBang_('DM_CHINHANH').filter(function (x) { return x.MA_CHI_NHANH === maCN; })[0];
  if (!c) throw new Error('Chi nhánh không tồn tại hoặc đã ngừng hoạt động.');
  p.MA_CHI_NHANH = c.MA_CHI_NHANH; p.TEN_CHI_NHANH = c.TEN_CHI_NHANH;
  p.DIA_CHI = full.DIA_CHI || ''; p.SO_DIEN_THOAI = full.SO_DIEN_THOAI || '';
  luuPhien_(token, p, true);
  return ketQuaPhien_(p);
}

function doiMatKhau(token, mkCu, mkMoi) {
  const p = phien_(token, { khongCanChiNhanh: true, choPhepDoiMK: true });
  kiemTraDoManh_(mkMoi);
  if (mkMoi === mkCu) throw new Error('Mật khẩu mới phải khác mật khẩu hiện tại.');
  return voiKhoa_(function () {
    const tk = docBang_('NS_TAIKHOAN').filter(function (x) { return x.MA_TAI_KHOAN === p.MA_TAI_KHOAN; })[0];
    if (!tk) throw new Error('PHIEN_HET_HAN');
    if (!kiemTraMK_(tk, String(mkCu || '')).ok) throw new Error('Mật khẩu hiện tại không đúng.');
    capNhat_('NS_TAIKHOAN', tk._row, Object.assign(patchMK_(mkMoi), { DOI_MAT_KHAU: false }));
    p.v = tangPhienBan_(tk, token); // đăng xuất các thiết bị khác
    p.DOI_MAT_KHAU = false;
    luuPhien_(token, p, true);
    return ketQuaPhien_(p);
  });
}

/* ============================ QUẢN TRỊ ============================ */

function quanLyDuoc_(p, nv) {
  if (p.VAI_TRO === VT.CHU_QUAN) return true;
  return p.VAI_TRO === VT.QUAN_LY && nv.MA_CHI_NHANH === p.MA_CHI_NHANH && VAI_TRO_QL_DUOC_GAN.indexOf(nv.VAI_TRO) >= 0;
}

function maMoi_(ds, cot, tienTo, rong) {
  let max = 0;
  const re = new RegExp('^' + tienTo + '(\\d+)$');
  ds.forEach(function (r) { const m = String(r[cot] || '').match(re); if (m) max = Math.max(max, +m[1]); });
  return tienTo + dem_(max + 1, rong);
}

function ngayTuChuoi_(s) {
  s = String(s || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error('Ngày không hợp lệ: ' + s);
  return new Date(+m[1], +m[2] - 1, +m[3]);
}

function qtLayDuLieu(token) {
  const p = phien_(token, { khongCanChiNhanh: true });
  yeuCau_(p, [VT.CHU_QUAN, VT.QUAN_LY]);
  const laCQ = p.VAI_TRO === VT.CHU_QUAN;
  const nvAll = docBang_('DM_NHANVIEN');
  const nv = laCQ ? nvAll : nvAll.filter(function (x) { return x.MA_CHI_NHANH === p.MA_CHI_NHANH; });
  const nvMap = {};
  nv.forEach(function (x) { nvMap[x.MA_NHAN_VIEN] = x; });
  const tkAll = docBang_('NS_TAIKHOAN');
  const tkTheoNV = {};
  tkAll.forEach(function (t) { tkTheoNV[t.MA_NHAN_VIEN] = t.TEN_DANG_NHAP; });
  const q = laCQ ? docThongTinQuan_() : null;
  return {
    laChuQuan: laCQ,
    maChiNhanh: p.MA_CHI_NHANH,
    thongTinQuan: laCQ ? THONG_TIN_QUAN.map(function (t) { return { KHOA: t[0], TEN_TRUONG: t[1], NOI_DUNG: q[t[0]] }; }) : null,
    chiNhanh: docBang_('DM_CHINHANH').map(function (c) {
      return { MA_CHI_NHANH: c.MA_CHI_NHANH, TEN_CHI_NHANH: c.TEN_CHI_NHANH, DIA_CHI: c.DIA_CHI || '',
        SO_DIEN_THOAI: c.SO_DIEN_THOAI || '', TRANG_THAI: c.TRANG_THAI };
    }),
    nhanVien: nv.map(function (x) {
      return { MA_NHAN_VIEN: x.MA_NHAN_VIEN, TEN_NHAN_VIEN: x.TEN_NHAN_VIEN, MA_CHI_NHANH: x.MA_CHI_NHANH, VAI_TRO: x.VAI_TRO,
        SO_DIEN_THOAI: x.SO_DIEN_THOAI || '', NGAY_VAO_LAM: x.NGAY_VAO_LAM || '', TRANG_THAI: x.TRANG_THAI,
        GHI_CHU: x.GHI_CHU || '', TAI_KHOAN: tkTheoNV[x.MA_NHAN_VIEN] || '',
        SUA_DUOC: quanLyDuoc_(p, x), LA_BAN_THAN: x.MA_NHAN_VIEN === p.MA_NHAN_VIEN };
    }),
    taiKhoan: tkAll.filter(function (t) { return nvMap[t.MA_NHAN_VIEN]; }).map(function (t) {
      const n = nvMap[t.MA_NHAN_VIEN];
      return { MA_TAI_KHOAN: t.MA_TAI_KHOAN, TEN_DANG_NHAP: t.TEN_DANG_NHAP, MA_NHAN_VIEN: t.MA_NHAN_VIEN,
        TEN_NHAN_VIEN: n.TEN_NHAN_VIEN, VAI_TRO: n.VAI_TRO, MA_CHI_NHANH: n.MA_CHI_NHANH,
        TRANG_THAI: t.TRANG_THAI, DOI_MAT_KHAU: laTrue_(t.DOI_MAT_KHAU), LAN_DANG_NHAP_CUOI: t.LAN_DANG_NHAP_CUOI || '',
        SUA_DUOC: quanLyDuoc_(p, n) && t.MA_TAI_KHOAN !== p.MA_TAI_KHOAN, LA_BAN_THAN: t.MA_TAI_KHOAN === p.MA_TAI_KHOAN };
    }),
    vaiTro: laCQ ? [VT.CHU_QUAN, VT.QUAN_LY, VT.THU_NGAN, VT.PHA_CHE, VT.PHUC_VU] : VAI_TRO_QL_DUOC_GAN,
    khuVuc: docBang_('DM_KHUVUC').filter(function (k) { return laCQ || k.MA_CHI_NHANH === p.MA_CHI_NHANH; }).sort(theoThuTu_)
      .map(function (k) { return { MA_KHU_VUC: k.MA_KHU_VUC, MA_CHI_NHANH: k.MA_CHI_NHANH, TEN_KHU_VUC: k.TEN_KHU_VUC, THU_TU: so_(k.THU_TU), TRANG_THAI: k.TRANG_THAI }; }),
    ban: docBang_('DM_BAN').filter(function (b) { return laCQ || b.MA_CHI_NHANH === p.MA_CHI_NHANH; }).sort(theoThuTu_)
      .map(function (b) { return { MA_BAN: b.MA_BAN, MA_CHI_NHANH: b.MA_CHI_NHANH, MA_KHU_VUC: b.MA_KHU_VUC, TEN_BAN: b.TEN_BAN, SO_CHO: so_(b.SO_CHO), THU_TU: so_(b.THU_TU), TRANG_THAI: b.TRANG_THAI }; }),
    banCoKhach: banCoKhach_(),
    suaThucDon: laCQ,
    nhomSanPham: laCQ ? docBang_('DM_NHOMSANPHAM').sort(theoThuTu_).map(function (n) {
      return { MA_NHOM_SAN_PHAM: n.MA_NHOM_SAN_PHAM, TEN_NHOM_SAN_PHAM: n.TEN_NHOM_SAN_PHAM, THU_TU: so_(n.THU_TU), TRANG_THAI: n.TRANG_THAI };
    }) : [],
    sanPham: laCQ ? docBang_('DM_SANPHAM').sort(theoThuTu_).map(function (s) {
      return { MA_SAN_PHAM: s.MA_SAN_PHAM, TEN_SAN_PHAM: s.TEN_SAN_PHAM, MA_NHOM_SAN_PHAM: s.MA_NHOM_SAN_PHAM, DON_VI_TINH: s.DON_VI_TINH,
        GIA_BAN: so_(s.GIA_BAN), GIA_VON: so_(s.GIA_VON), HINH_ANH: s.HINH_ANH || '', THU_TU: so_(s.THU_TU), TRANG_THAI: s.TRANG_THAI, GHI_CHU: s.GHI_CHU || '' };
    }) : [],
    donViTinh: docBang_('DM_DONVITINH').map(function (d) { return d.TEN_DON_VI_TINH; }).filter(String)
  };
}

function banCoKhach_() {
  const kq = {};
  dangMo_('').forEach(function (h) { if (h.MA_BAN) kq[h.MA_BAN] = true; });
  return kq;
}

/** dl = {maCu?, MA_CHI_NHANH?, TEN_CHI_NHANH, DIA_CHI, SO_DIEN_THOAI, TRANG_THAI, soBan?} */
function qtLuuChiNhanh(token, dl) {
  const p = phien_(token, { khongCanChiNhanh: true });
  yeuCau_(p, [VT.CHU_QUAN]);
  dl = dl || {};
  const ten = String(dl.TEN_CHI_NHANH || '').trim();
  if (!ten) throw new Error('Vui lòng nhập tên chi nhánh.');
  const tt = dl.TRANG_THAI === TT.NGUNG ? TT.NGUNG : TT.HOAT_DONG;
  const sdt = String(dl.SO_DIEN_THOAI || '').replace(/[^\d+]/g, '');
  voiKhoa_(function () {
    const ds = docBang_('DM_CHINHANH');
    if (dl.maCu) {
      const cu = ds.filter(function (c) { return c.MA_CHI_NHANH === dl.maCu; })[0];
      if (!cu) throw new Error('Không tìm thấy chi nhánh.');
      if (tt === TT.NGUNG && cu.TRANG_THAI !== TT.NGUNG &&
        ds.filter(function (c) { return c.TRANG_THAI !== TT.NGUNG; }).length <= 1) {
        throw new Error('Phải còn ít nhất một chi nhánh đang hoạt động.');
      }
      capNhat_('DM_CHINHANH', cu._row, { TEN_CHI_NHANH: ten, DIA_CHI: String(dl.DIA_CHI || '').trim(), SO_DIEN_THOAI: sdt, TRANG_THAI: tt });
      return;
    }
    let ma = String(dl.MA_CHI_NHANH || '').trim().toUpperCase();
    if (!ma) ma = maMoi_(ds, 'MA_CHI_NHANH', 'CN', 2);
    if (!/^[A-Z0-9]{2,10}$/.test(ma)) throw new Error('Mã chi nhánh chỉ gồm chữ in hoa và số, 2–10 ký tự.');
    if (ds.some(function (c) { return String(c.MA_CHI_NHANH).toUpperCase() === ma; })) throw new Error('Mã chi nhánh ' + ma + ' đã tồn tại.');
    themDong_('DM_CHINHANH', [{ MA_CHI_NHANH: ma, TEN_CHI_NHANH: ten, DIA_CHI: String(dl.DIA_CHI || '').trim(), SO_DIEN_THOAI: sdt, TRANG_THAI: tt }]);
    const soBan = Math.min(100, Math.max(0, Math.floor(so_(dl.soBan))));
    if (soBan) {
      const kv = ma + '-KV1';
      themDong_('DM_KHUVUC', [{ MA_KHU_VUC: kv, MA_CHI_NHANH: ma, TEN_KHU_VUC: 'Khu chung', THU_TU: 1, TRANG_THAI: TT.HOAT_DONG }]);
      const ban = [];
      for (let i = 1; i <= soBan; i++) {
        ban.push({ MA_BAN: ma + '-B' + dem_(i, 2), MA_CHI_NHANH: ma, MA_KHU_VUC: kv, TEN_BAN: 'Bàn ' + dem_(i, 2), SO_CHO: 4, THU_TU: i, TRANG_THAI: TT.HOAT_DONG });
      }
      themDong_('DM_BAN', ban);
    }
  });
  return qtLayDuLieu(token);
}

/**
 * dl = {maCu?, MA_NHAN_VIEN?, TEN_NHAN_VIEN, MA_CHI_NHANH, VAI_TRO, SO_DIEN_THOAI, NGAY_VAO_LAM, TRANG_THAI, GHI_CHU,
 *       taiKhoan?: {tenDangNhap, matKhau, doiMatKhau}}
 */
function qtLuuNhanVien(token, dl) {
  const p = phien_(token, { khongCanChiNhanh: true });
  yeuCau_(p, [VT.CHU_QUAN, VT.QUAN_LY]);
  dl = dl || {};
  const laCQ = p.VAI_TRO === VT.CHU_QUAN;
  voiKhoa_(function () {
    const ds = docBang_('DM_NHANVIEN');
    const cu = dl.maCu ? ds.filter(function (x) { return x.MA_NHAN_VIEN === dl.maCu; })[0] : null;
    if (dl.maCu && !cu) throw new Error('Không tìm thấy nhân viên.');
    const banThan = cu && cu.MA_NHAN_VIEN === p.MA_NHAN_VIEN;
    if (cu && !quanLyDuoc_(p, cu) && !(banThan && laCQ)) throw new Error('Bạn không có quyền sửa nhân viên này.');

    const moi = {
      TEN_NHAN_VIEN: String(dl.TEN_NHAN_VIEN || '').trim(),
      SO_DIEN_THOAI: String(dl.SO_DIEN_THOAI || '').replace(/\D/g, ''),
      MA_CHI_NHANH: String(dl.MA_CHI_NHANH || '').trim(),
      VAI_TRO: dl.VAI_TRO,
      NGAY_VAO_LAM: ngayTuChuoi_(dl.NGAY_VAO_LAM),
      TRANG_THAI: dl.TRANG_THAI === TT.NGHI_VIEC ? TT.NGHI_VIEC : TT.DANG_LAM,
      GHI_CHU: String(dl.GHI_CHU || '').trim().slice(0, 300)
    };
    if (!moi.TEN_NHAN_VIEN) throw new Error('Vui lòng nhập họ tên nhân viên.');
    if (moi.SO_DIEN_THOAI && moi.SO_DIEN_THOAI.length < 9) throw new Error('Số điện thoại không hợp lệ.');
    const vaiTroHopLe = laCQ ? [VT.CHU_QUAN, VT.QUAN_LY, VT.THU_NGAN, VT.PHA_CHE, VT.PHUC_VU] : VAI_TRO_QL_DUOC_GAN;
    if (banThan) { moi.VAI_TRO = cu.VAI_TRO; moi.TRANG_THAI = TT.DANG_LAM; }
    else if (vaiTroHopLe.indexOf(moi.VAI_TRO) < 0) throw new Error('Vai trò không hợp lệ hoặc vượt quyền của bạn.');

    if (!laCQ) moi.MA_CHI_NHANH = p.MA_CHI_NHANH;
    if (moi.MA_CHI_NHANH === '*') {
      if (moi.VAI_TRO !== VT.CHU_QUAN && moi.VAI_TRO !== VT.QUAN_LY) throw new Error('Chỉ chủ quán hoặc quản lý mới được gán "Tất cả chi nhánh".');
    } else if (!docBang_('DM_CHINHANH').some(function (c) { return c.MA_CHI_NHANH === moi.MA_CHI_NHANH; })) {
      throw new Error('Vui lòng chọn chi nhánh hợp lệ.');
    }

    if (cu && cu.VAI_TRO === VT.CHU_QUAN && (moi.VAI_TRO !== VT.CHU_QUAN || moi.TRANG_THAI === TT.NGHI_VIEC)) {
      const conLai = ds.filter(function (x) {
        return x.MA_NHAN_VIEN !== cu.MA_NHAN_VIEN && x.VAI_TRO === VT.CHU_QUAN && x.TRANG_THAI !== TT.NGHI_VIEC;
      }).length;
      if (!conLai) throw new Error('Hệ thống phải còn ít nhất một chủ quán đang làm việc.');
    }

    const coTK = dl.taiKhoan && dl.taiKhoan.tenDangNhap;
    if (coTK) {
      kiemTraTaiKhoanMoi_(dl.taiKhoan);
      if (moi.TRANG_THAI === TT.NGHI_VIEC) throw new Error('Không tạo tài khoản cho nhân viên đã nghỉ việc.');
      if (cu && docBang_('NS_TAIKHOAN').some(function (t) { return t.MA_NHAN_VIEN === cu.MA_NHAN_VIEN; })) throw new Error('Nhân viên này đã có tài khoản.');
    }

    let ma;
    if (cu) {
      ma = cu.MA_NHAN_VIEN;
      capNhat_('DM_NHANVIEN', cu._row, moi);
      const thayDoiQuyen = cu.VAI_TRO !== moi.VAI_TRO || cu.MA_CHI_NHANH !== moi.MA_CHI_NHANH || moi.TRANG_THAI === TT.NGHI_VIEC;
      if (thayDoiQuyen) {
        docBang_('NS_TAIKHOAN').filter(function (t) { return t.MA_NHAN_VIEN === ma; })
          .forEach(function (t) { tangPhienBan_(t); });
      }
    } else {
      ma = String(dl.MA_NHAN_VIEN || '').trim().toUpperCase() || maMoi_(ds, 'MA_NHAN_VIEN', 'NV', 3);
      if (!/^[A-Z0-9_-]{2,20}$/.test(ma)) throw new Error('Mã nhân viên chỉ gồm chữ in hoa, số, "-" hoặc "_".');
      if (ds.some(function (x) { return String(x.MA_NHAN_VIEN).toUpperCase() === ma; })) throw new Error('Mã nhân viên ' + ma + ' đã tồn tại.');
      moi.MA_NHAN_VIEN = ma;
      themDong_('DM_NHANVIEN', [moi]);
    }
    if (coTK) taoTaiKhoan_(p, ma, dl.taiKhoan);
  });
  return qtLayDuLieu(token);
}

/** Kiểm tra tên đăng nhập + mật khẩu trước khi ghi bất kỳ dữ liệu nào. */
function kiemTraTaiKhoanMoi_(tkDl) {
  const ten = String(tkDl.tenDangNhap || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(ten)) throw new Error('Tên đăng nhập 3–30 ký tự, chỉ gồm chữ không dấu, số, dấu chấm, gạch ngang hoặc gạch dưới.');
  kiemTraDoManh_(tkDl.matKhau);
  if (docBang_('NS_TAIKHOAN').some(function (t) { return String(t.TEN_DANG_NHAP).toLowerCase() === ten; })) {
    throw new Error('Tên đăng nhập "' + ten + '" đã được dùng.');
  }
  return ten;
}

function taoTaiKhoan_(p, maNV, tkDl) {
  const nv = docBang_('DM_NHANVIEN').filter(function (x) { return x.MA_NHAN_VIEN === maNV; })[0];
  if (!nv) throw new Error('Không tìm thấy nhân viên.');
  if (!quanLyDuoc_(p, nv)) throw new Error('Bạn không có quyền tạo tài khoản cho nhân viên này.');
  if (nv.TRANG_THAI === TT.NGHI_VIEC) throw new Error('Nhân viên đã nghỉ việc.');
  const ten = kiemTraTaiKhoanMoi_(tkDl);
  const ds = docBang_('NS_TAIKHOAN');
  if (ds.some(function (t) { return t.MA_NHAN_VIEN === maNV; })) throw new Error('Nhân viên này đã có tài khoản.');
  themDong_('NS_TAIKHOAN', [Object.assign({
    MA_TAI_KHOAN: maMoi_(ds, 'MA_TAI_KHOAN', 'TK', 3), TEN_DANG_NHAP: ten, MA_NHAN_VIEN: maNV,
    DOI_MAT_KHAU: tkDl.doiMatKhau !== false, PHIEN_BAN: 1, TRANG_THAI: TT_TK.HOAT_DONG,
    LAN_DANG_NHAP_CUOI: '', NGAY_TAO: new Date(), NGUOI_TAO: p.MA_NHAN_VIEN, GHI_CHU: ''
  }, patchMK_(String(tkDl.matKhau)))]);
}

function qtTaoTaiKhoan(token, dl) {
  const p = phien_(token, { khongCanChiNhanh: true });
  yeuCau_(p, [VT.CHU_QUAN, VT.QUAN_LY]);
  voiKhoa_(function () { taoTaiKhoan_(p, (dl || {}).maNhanVien, dl || {}); });
  return qtLayDuLieu(token);
}

function layTKQuanLy_(p, maTK) {
  yeuCau_(p, [VT.CHU_QUAN, VT.QUAN_LY]);
  const tk = docBang_('NS_TAIKHOAN').filter(function (t) { return t.MA_TAI_KHOAN === maTK; })[0];
  if (!tk) throw new Error('Không tìm thấy tài khoản.');
  if (tk.MA_TAI_KHOAN === p.MA_TAI_KHOAN) throw new Error('Hãy dùng chức năng "Đổi mật khẩu" cho tài khoản của chính bạn.');
  const nv = docBang_('DM_NHANVIEN').filter(function (x) { return x.MA_NHAN_VIEN === tk.MA_NHAN_VIEN; })[0];
  if (!nv || !quanLyDuoc_(p, nv)) throw new Error('Bạn không có quyền quản lý tài khoản này.');
  return tk;
}

function qtDatLaiMatKhau(token, maTK, matKhau, doiMatKhau) {
  const p = phien_(token, { khongCanChiNhanh: true });
  kiemTraDoManh_(matKhau);
  voiKhoa_(function () {
    const tk = layTKQuanLy_(p, maTK);
    capNhat_('NS_TAIKHOAN', tk._row, Object.assign(patchMK_(String(matKhau)), { DOI_MAT_KHAU: doiMatKhau !== false }));
    tangPhienBan_(tk);
    CacheService.getScriptCache().remove('SAI_' + String(tk.TEN_DANG_NHAP).toLowerCase());
  });
  return qtLayDuLieu(token);
}

function qtKhoaTaiKhoan(token, maTK, khoa) {
  const p = phien_(token, { khongCanChiNhanh: true });
  voiKhoa_(function () {
    const tk = layTKQuanLy_(p, maTK);
    capNhat_('NS_TAIKHOAN', tk._row, { TRANG_THAI: khoa ? TT_TK.KHOA : TT_TK.HOAT_DONG });
    if (khoa) tangPhienBan_(tk);
  });
  return qtLayDuLieu(token);
}

function qtDangXuatMoiNoi(token, maTK) {
  const p = phien_(token, { khongCanChiNhanh: true });
  voiKhoa_(function () { tangPhienBan_(layTKQuanLy_(p, maTK)); });
  return qtLayDuLieu(token);
}

/* ============================ KHỞI TẠO / CHUYỂN ĐỔI ============================ */

/** Chuyển MA_PIN (giai đoạn 1) sang NS_TAIKHOAN. Tên đăng nhập = mã NV viết thường, mật khẩu = PIN cũ. */
function chuyenDoiTaiKhoan_() {
  if (sheet_('NS_TAIKHOAN').getLastRow() >= 2) return 0;
  if (tieuDe_('DM_NHANVIEN').indexOf('MA_PIN') < 0) return 0;
  const ds = docBang_('DM_NHANVIEN').filter(function (n) { return String(n.MA_PIN == null ? '' : n.MA_PIN) !== ''; });
  if (!ds.length) return 0;
  const now = new Date();
  themDong_('NS_TAIKHOAN', ds.map(function (n, i) {
    const pin = String(n.MA_PIN);
    const daBam = /^[0-9a-f]{64}$/.test(pin);
    return {
      MA_TAI_KHOAN: 'TK' + dem_(i + 1, 3), TEN_DANG_NHAP: String(n.MA_NHAN_VIEN).toLowerCase(), MA_NHAN_VIEN: n.MA_NHAN_VIEN,
      MAT_KHAU: pin, MUOI: daBam ? 'LEGACY:' + n.MA_NHAN_VIEN : '', DOI_MAT_KHAU: true, PHIEN_BAN: 1,
      TRANG_THAI: n.TRANG_THAI === TT.NGHI_VIEC ? TT_TK.KHOA : TT_TK.HOAT_DONG,
      LAN_DANG_NHAP_CUOI: '', NGAY_TAO: now, NGUOI_TAO: 'CHUYEN_DOI', GHI_CHU: 'Chuyển từ mã PIN cũ'
    };
  }));
  ds.forEach(function (n) { capNhat_('DM_NHANVIEN', n._row, { MA_PIN: '' }); });
  return ds.length;
}

function napTaiKhoanMau_() {
  if (sheet_('NS_TAIKHOAN').getLastRow() >= 2) return;
  const mau = [['TK001', 'chuquan', 'NV001'], ['TK002', 'thungan1', 'NV002'], ['TK003', 'phache1', 'NV003'],
    ['TK004', 'phucvu1', 'NV004'], ['TK005', 'quanly2', 'NV005']];
  const coNV = {};
  docBang_('DM_NHANVIEN').forEach(function (n) { coNV[n.MA_NHAN_VIEN] = true; });
  const now = new Date();
  themDong_('NS_TAIKHOAN', mau.filter(function (m) { return coNV[m[2]]; }).map(function (m) {
    return Object.assign({ MA_TAI_KHOAN: m[0], TEN_DANG_NHAP: m[1], MA_NHAN_VIEN: m[2], DOI_MAT_KHAU: true, PHIEN_BAN: 1,
      TRANG_THAI: TT_TK.HOAT_DONG, LAN_DANG_NHAP_CUOI: '', NGAY_TAO: now, NGUOI_TAO: 'KHOI_TAO', GHI_CHU: 'Tài khoản mẫu' },
      patchMK_(MAT_KHAU_MAU));
  }));
}

function napThongTinQuan_() {
  const co = {};
  docBang_('HT_THONGTINQUAN').forEach(function (r) { co[r.KHOA] = true; });
  themDong_('HT_THONGTINQUAN', THONG_TIN_QUAN.filter(function (t) { return !co[t[0]]; })
    .map(function (t) { return { KHOA: t[0], TEN_TRUONG: t[1], NOI_DUNG: t[2] }; }));
}

/* ============================ CỨU HỘ ĐĂNG NHẬP ============================ */

/**
 * Chạy trong Apps Script (hoặc menu ☕ Quản lý quán) khi không ai đăng nhập được.
 * - Đặt mật khẩu mọi tài khoản của nhân viên đang làm về 123456, mở khóa, bắt buộc đổi mật khẩu khi đăng nhập.
 * - Nhân viên đang làm mà chưa có tài khoản: tạo tài khoản, tên đăng nhập = mã nhân viên viết thường.
 * - Đăng xuất mọi thiết bị, xóa bộ đếm nhập sai.
 */
function datLaiMatKhauMacDinh() {
  _DA_TU_SUA = false;
  sheet_('NS_TAIKHOAN'); // tự tạo bảng nếu còn thiếu
  const dong = voiKhoa_(function () {
    const cache = CacheService.getScriptCache();
    const nvDs = docBang_('DM_NHANVIEN').filter(function (n) { return n.MA_NHAN_VIEN && n.TRANG_THAI !== TT.NGHI_VIEC; });
    const tkDs = docBang_('NS_TAIKHOAN');
    const daDung = {};
    tkDs.forEach(function (t) { daDung[String(t.TEN_DANG_NHAP).toLowerCase()] = true; });
    const kq = [], them = [];
    nvDs.forEach(function (nv) {
      const tk = tkDs.filter(function (t) { return t.MA_NHAN_VIEN === nv.MA_NHAN_VIEN; })[0];
      if (tk) {
        capNhat_('NS_TAIKHOAN', tk._row, Object.assign(patchMK_(MAT_KHAU_MAU), { DOI_MAT_KHAU: true, TRANG_THAI: TT_TK.HOAT_DONG }));
        tangPhienBan_(tk);
        cache.remove('SAI_' + String(tk.TEN_DANG_NHAP).toLowerCase());
        kq.push(tk.TEN_DANG_NHAP + '  –  ' + nv.TEN_NHAN_VIEN + ' (' + nv.VAI_TRO + ')');
      } else {
        let ten = String(nv.MA_NHAN_VIEN).toLowerCase().replace(/[^a-z0-9._-]/g, '');
        let i = 1, goc = ten;
        while (daDung[ten]) ten = goc + (++i);
        daDung[ten] = true;
        them.push(Object.assign({
          MA_TAI_KHOAN: maMoi_(tkDs.concat(them), 'MA_TAI_KHOAN', 'TK', 3), TEN_DANG_NHAP: ten, MA_NHAN_VIEN: nv.MA_NHAN_VIEN,
          DOI_MAT_KHAU: true, PHIEN_BAN: 1, TRANG_THAI: TT_TK.HOAT_DONG, LAN_DANG_NHAP_CUOI: '',
          NGAY_TAO: new Date(), NGUOI_TAO: 'CUU_HO', GHI_CHU: 'Tạo khi đặt lại mật khẩu mặc định'
        }, patchMK_(MAT_KHAU_MAU)));
        kq.push(ten + '  –  ' + nv.TEN_NHAN_VIEN + ' (' + nv.VAI_TRO + ')  [mới tạo]');
      }
    });
    themDong_('NS_TAIKHOAN', them);
    return kq;
  });
  const msg = dong.length
    ? 'Đã đặt mật khẩu ' + MAT_KHAU_MAU + ' cho ' + dong.length + ' tài khoản (đăng nhập xong sẽ phải đổi mật khẩu):\n\n' + dong.join('\n')
    : 'Không có nhân viên nào đang làm việc trong bảng DM_NHANVIEN.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert('Đặt lại mật khẩu', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { /* chạy trong trình soạn thảo */ }
  return msg;
}


/* ============================ BÀN & KHU VỰC ============================ */

function chiNhanhQuanLy_(p, cn) {
  if (p.VAI_TRO !== VT.CHU_QUAN) return p.MA_CHI_NHANH;
  cn = String(cn || '').trim();
  if (!docBang_('DM_CHINHANH').some(function (c) { return c.MA_CHI_NHANH === cn; })) throw new Error('Vui lòng chọn chi nhánh hợp lệ.');
  return cn;
}

function trangThaiHD_(v) { return v === TT.NGUNG ? TT.NGUNG : TT.HOAT_DONG; }

/** dl = {maCu?, MA_CHI_NHANH, TEN_KHU_VUC, THU_TU, TRANG_THAI} */
function qtLuuKhuVuc(token, dl) {
  const p = phien_(token, { khongCanChiNhanh: true });
  yeuCau_(p, [VT.CHU_QUAN, VT.QUAN_LY]);
  dl = dl || {};
  const ten = String(dl.TEN_KHU_VUC || '').trim();
  if (!ten) throw new Error('Vui lòng nhập tên khu vực.');
  const tt = trangThaiHD_(dl.TRANG_THAI);
  voiKhoa_(function () {
    const ds = docBang_('DM_KHUVUC');
    if (dl.maCu) {
      const cu = ds.filter(function (k) { return k.MA_KHU_VUC === dl.maCu; })[0];
      if (!cu) throw new Error('Không tìm thấy khu vực.');
      if (p.VAI_TRO !== VT.CHU_QUAN && cu.MA_CHI_NHANH !== p.MA_CHI_NHANH) throw new Error('Bạn không có quyền sửa khu vực này.');
      if (tt === TT.NGUNG && cu.TRANG_THAI !== TT.NGUNG && docBang_('DM_BAN').some(function (b) {
        return b.MA_KHU_VUC === cu.MA_KHU_VUC && b.TRANG_THAI !== TT.NGUNG;
      })) throw new Error('Khu vực còn bàn đang hoạt động. Hãy chuyển các bàn sang khu vực khác hoặc ngừng các bàn trước.');
      capNhat_('DM_KHUVUC', cu._row, { TEN_KHU_VUC: ten, THU_TU: so_(dl.THU_TU), TRANG_THAI: tt });
      return;
    }
    const cn = chiNhanhQuanLy_(p, dl.MA_CHI_NHANH);
    const cungCN = ds.filter(function (k) { return k.MA_CHI_NHANH === cn; });
    if (cungCN.some(function (k) { return String(k.TEN_KHU_VUC).toLowerCase() === ten.toLowerCase(); })) throw new Error('Chi nhánh đã có khu vực "' + ten + '".');
    themDong_('DM_KHUVUC', [{
      MA_KHU_VUC: maMoi_(ds, 'MA_KHU_VUC', cn + '-KV', 1), MA_CHI_NHANH: cn, TEN_KHU_VUC: ten,
      THU_TU: dl.THU_TU !== '' && dl.THU_TU != null ? so_(dl.THU_TU) : cungCN.length + 1, TRANG_THAI: tt
    }]);
  });
  return qtLayDuLieu(token);
}

function kiemTraKhuVuc_(maKV, cn) {
  const kv = docBang_('DM_KHUVUC').filter(function (k) { return k.MA_KHU_VUC === maKV; })[0];
  if (!kv || kv.MA_CHI_NHANH !== cn) throw new Error('Vui lòng chọn khu vực thuộc chi nhánh.');
  return kv;
}

/** dl = {maCu?, MA_CHI_NHANH, MA_KHU_VUC, TEN_BAN, SO_CHO, THU_TU, TRANG_THAI} */
function qtLuuBan(token, dl) {
  const p = phien_(token, { khongCanChiNhanh: true });
  yeuCau_(p, [VT.CHU_QUAN, VT.QUAN_LY]);
  dl = dl || {};
  const ten = String(dl.TEN_BAN || '').trim();
  if (!ten) throw new Error('Vui lòng nhập tên / số bàn.');
  const soCho = Math.floor(so_(dl.SO_CHO));
  if (soCho < 0 || soCho > 100) throw new Error('Số chỗ ngồi không hợp lệ.');
  const tt = trangThaiHD_(dl.TRANG_THAI);
  voiKhoa_(function () {
    const ds = docBang_('DM_BAN');
    const cu = dl.maCu ? ds.filter(function (b) { return b.MA_BAN === dl.maCu; })[0] : null;
    if (dl.maCu && !cu) throw new Error('Không tìm thấy bàn.');
    if (cu && p.VAI_TRO !== VT.CHU_QUAN && cu.MA_CHI_NHANH !== p.MA_CHI_NHANH) throw new Error('Bạn không có quyền sửa bàn này.');
    const cn = cu ? cu.MA_CHI_NHANH : chiNhanhQuanLy_(p, dl.MA_CHI_NHANH);
    kiemTraKhuVuc_(dl.MA_KHU_VUC, cn);
    if (ds.some(function (b) {
      return b.MA_CHI_NHANH === cn && b.MA_BAN !== (cu && cu.MA_BAN) && b.TRANG_THAI !== TT.NGUNG &&
        String(b.TEN_BAN).toLowerCase() === ten.toLowerCase();
    })) throw new Error('Chi nhánh đã có bàn tên "' + ten + '".');
    if (cu && tt === TT.NGUNG && banCoKhach_()[cu.MA_BAN]) throw new Error(cu.TEN_BAN + ' đang có khách, không thể ngừng sử dụng.');
    const moi = { MA_KHU_VUC: dl.MA_KHU_VUC, TEN_BAN: ten, SO_CHO: soCho, TRANG_THAI: tt };
    if (cu) {
      if (dl.THU_TU !== '' && dl.THU_TU != null) moi.THU_TU = so_(dl.THU_TU);
      capNhat_('DM_BAN', cu._row, moi);
    } else {
      moi.MA_BAN = maMoi_(ds, 'MA_BAN', cn + '-B', 2);
      moi.MA_CHI_NHANH = cn;
      moi.THU_TU = dl.THU_TU !== '' && dl.THU_TU != null ? so_(dl.THU_TU)
        : ds.filter(function (b) { return b.MA_CHI_NHANH === cn; }).reduce(function (m, b) { return Math.max(m, so_(b.THU_TU)); }, 0) + 1;
      themDong_('DM_BAN', [moi]);
    }
  });
  return qtLayDuLieu(token);
}

/** Thêm nhanh nhiều bàn: dl = {MA_CHI_NHANH, MA_KHU_VUC, soLuong, tienTo, batDau, SO_CHO} */
function qtThemNhieuBan(token, dl) {
  const p = phien_(token, { khongCanChiNhanh: true });
  yeuCau_(p, [VT.CHU_QUAN, VT.QUAN_LY]);
  dl = dl || {};
  const n = Math.floor(so_(dl.soLuong));
  if (n < 1 || n > 50) throw new Error('Số lượng bàn từ 1 đến 50.');
  const batDau = Math.max(1, Math.floor(so_(dl.batDau) || 1));
  const tienTo = String(dl.tienTo == null ? 'Bàn ' : dl.tienTo);
  const soCho = Math.min(100, Math.max(0, Math.floor(so_(dl.SO_CHO))));
  voiKhoa_(function () {
    const cn = chiNhanhQuanLy_(p, dl.MA_CHI_NHANH);
    kiemTraKhuVuc_(dl.MA_KHU_VUC, cn);
    const ds = docBang_('DM_BAN');
    const tenCo = {};
    ds.forEach(function (b) { if (b.MA_CHI_NHANH === cn && b.TRANG_THAI !== TT.NGUNG) tenCo[String(b.TEN_BAN).toLowerCase()] = true; });
    let thuTu = ds.filter(function (b) { return b.MA_CHI_NHANH === cn; }).reduce(function (m, b) { return Math.max(m, so_(b.THU_TU)); }, 0);
    const moi = [], trung = [];
    for (let i = 0; i < n; i++) {
      const ten = (tienTo + dem_(batDau + i, 2)).trim();
      if (tenCo[ten.toLowerCase()]) { trung.push(ten); continue; }
      const ma = maMoi_(ds.concat(moi), 'MA_BAN', cn + '-B', 2);
      moi.push({ MA_BAN: ma, MA_CHI_NHANH: cn, MA_KHU_VUC: dl.MA_KHU_VUC, TEN_BAN: ten, SO_CHO: soCho, THU_TU: ++thuTu, TRANG_THAI: TT.HOAT_DONG });
    }
    if (trung.length) throw new Error('Đã có bàn trùng tên: ' + trung.join(', ') + '. Hãy đổi "Bắt đầu từ số".');
    themDong_('DM_BAN', moi);
  });
  return qtLayDuLieu(token);
}

/* ============================ THỰC ĐƠN ============================ */

/** dl = {maCu?, MA_NHOM_SAN_PHAM?, TEN_NHOM_SAN_PHAM, THU_TU, TRANG_THAI} */
function qtLuuNhomSP(token, dl) {
  const p = phien_(token, { khongCanChiNhanh: true });
  yeuCau_(p, [VT.CHU_QUAN]);
  dl = dl || {};
  const ten = String(dl.TEN_NHOM_SAN_PHAM || '').trim();
  if (!ten) throw new Error('Vui lòng nhập tên nhóm món.');
  const tt = trangThaiHD_(dl.TRANG_THAI);
  voiKhoa_(function () {
    const ds = docBang_('DM_NHOMSANPHAM');
    if (dl.maCu) {
      const cu = ds.filter(function (x) { return x.MA_NHOM_SAN_PHAM === dl.maCu; })[0];
      if (!cu) throw new Error('Không tìm thấy nhóm món.');
      capNhat_('DM_NHOMSANPHAM', cu._row, { TEN_NHOM_SAN_PHAM: ten, THU_TU: so_(dl.THU_TU), TRANG_THAI: tt });
      return;
    }
    if (ds.some(function (x) { return String(x.TEN_NHOM_SAN_PHAM).toLowerCase() === ten.toLowerCase(); })) throw new Error('Đã có nhóm "' + ten + '".');
    let ma = String(dl.MA_NHOM_SAN_PHAM || '').trim().toUpperCase() || maMoi_(ds, 'MA_NHOM_SAN_PHAM', 'NHOM', 2);
    if (!/^[A-Z0-9_]{2,20}$/.test(ma)) throw new Error('Mã nhóm chỉ gồm chữ in hoa không dấu, số và "_".');
    if (ds.some(function (x) { return String(x.MA_NHOM_SAN_PHAM).toUpperCase() === ma; })) throw new Error('Mã nhóm ' + ma + ' đã tồn tại.');
    themDong_('DM_NHOMSANPHAM', [{ MA_NHOM_SAN_PHAM: ma, TEN_NHOM_SAN_PHAM: ten,
      THU_TU: dl.THU_TU !== '' && dl.THU_TU != null ? so_(dl.THU_TU) : ds.length + 1, TRANG_THAI: tt }]);
  });
  return qtLayDuLieu(token);
}

/**
 * dl = {maCu?, MA_SAN_PHAM?, TEN_SAN_PHAM, MA_NHOM_SAN_PHAM, DON_VI_TINH, GIA_BAN, GIA_VON, THU_TU, TRANG_THAI, GHI_CHU,
 *       HINH_ANH (link https hoặc ''), anhMoi?: {base64, mimeType, tenFile}}
 */
function qtLuuSanPham(token, dl) {
  const p = phien_(token, { khongCanChiNhanh: true });
  yeuCau_(p, [VT.CHU_QUAN]);
  dl = dl || {};
  const ten = String(dl.TEN_SAN_PHAM || '').trim();
  if (!ten) throw new Error('Vui lòng nhập tên món.');
  const giaBan = Math.round(so_(dl.GIA_BAN)), giaVon = Math.round(so_(dl.GIA_VON));
  if (giaBan < 0 || giaVon < 0) throw new Error('Giá không được âm.');
  if (!(giaBan > 0)) throw new Error('Vui lòng nhập giá bán.');
  const dvt = String(dl.DON_VI_TINH || '').trim() || 'Ly';
  const tt = dl.TRANG_THAI === TT.NGUNG_BAN ? TT.NGUNG_BAN : TT.DANG_BAN;
  const ch = chuanHoaLinkAnh_(dl.HINH_ANH);
  let link = ch.link || '';
  if (ch.anh && !(dl.anhMoi && dl.anhMoi.base64)) dl.anhMoi = ch.anh; // dán dữ liệu ảnh → tải lên Drive

  const ds = docBang_('DM_SANPHAM');
  const cu = dl.maCu ? ds.filter(function (s) { return s.MA_SAN_PHAM === dl.maCu; })[0] : null;
  if (dl.maCu && !cu) throw new Error('Không tìm thấy món.');
  if (!docBang_('DM_NHOMSANPHAM').some(function (n) { return n.MA_NHOM_SAN_PHAM === dl.MA_NHOM_SAN_PHAM; })) throw new Error('Vui lòng chọn nhóm món.');
  if (ds.some(function (s) {
    return s.MA_SAN_PHAM !== (cu && cu.MA_SAN_PHAM) && s.TRANG_THAI === TT.DANG_BAN && String(s.TEN_SAN_PHAM).toLowerCase() === ten.toLowerCase();
  }) && tt === TT.DANG_BAN) throw new Error('Đã có món "' + ten + '" đang bán.');

  // Ảnh: tải lên Drive trước (ngoài khóa) vì có thể mất vài giây
  if (dl.anhMoi && dl.anhMoi.base64) link = luuAnhDrive_(dl.anhMoi, ten);
  const anhCu = cu ? String(cu.HINH_ANH || '') : '';

  voiKhoa_(function () {
    const dvtCo = docBang_('DM_DONVITINH');
    if (!dvtCo.some(function (d) { return String(d.TEN_DON_VI_TINH).toLowerCase() === dvt.toLowerCase(); })) {
      themDong_('DM_DONVITINH', [{ MA_DON_VI_TINH: khongDauMa_(dvt), TEN_DON_VI_TINH: dvt }]);
    }
    const moi = { TEN_SAN_PHAM: ten, MA_NHOM_SAN_PHAM: dl.MA_NHOM_SAN_PHAM, DON_VI_TINH: dvt, GIA_BAN: giaBan, GIA_VON: giaVon,
      HINH_ANH: link, TRANG_THAI: tt, GHI_CHU: String(dl.GHI_CHU || '').trim().slice(0, 300) };
    if (cu) {
      if (dl.THU_TU !== '' && dl.THU_TU != null) moi.THU_TU = so_(dl.THU_TU);
      capNhat_('DM_SANPHAM', cu._row, moi);
    } else {
      const dsMoi = docBang_('DM_SANPHAM');
      let ma = String(dl.MA_SAN_PHAM || '').trim().toUpperCase() || maMoi_(dsMoi, 'MA_SAN_PHAM', 'SP', 3);
      if (!/^[A-Z0-9_-]{2,20}$/.test(ma)) throw new Error('Mã món chỉ gồm chữ in hoa không dấu, số, "-" hoặc "_".');
      if (dsMoi.some(function (s) { return String(s.MA_SAN_PHAM).toUpperCase() === ma; })) throw new Error('Mã món ' + ma + ' đã tồn tại.');
      moi.MA_SAN_PHAM = ma;
      moi.THU_TU = dl.THU_TU !== '' && dl.THU_TU != null ? so_(dl.THU_TU)
        : dsMoi.reduce(function (m, s) { return Math.max(m, so_(s.THU_TU)); }, 0) + 1;
      themDong_('DM_SANPHAM', [moi]);
    }
  });
  if (anhCu && anhCu !== link) xoaAnhDrive_(anhCu);
  return qtLayDuLieu(token);
}

function khongDauMa_(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 20) || 'DVT';
}

/* ============================ ẢNH MÓN (GOOGLE DRIVE) ============================ */

/**
 * Chuẩn hóa link ảnh dán từ mạng: http → https, thiếu "https://" thì thêm,
 * link trang Google Hình ảnh (imgres?imgurl=…) thì lấy link ảnh gốc.
 * Trả về {link} hoặc {anh} (khi dán dữ liệu ảnh data:image/...;base64).
 */
function chuanHoaLinkAnh_(s) {
  s = String(s || '').trim().replace(/^["'<\s]+|["'>\s]+$/g, '');
  if (!s) return { link: '' };
  const d = s.match(/^data:(image\/[\w.+-]+);base64,(.+)$/i);
  if (d) return { anh: { mimeType: d[1].toLowerCase(), base64: d[2] } };
  const g = s.match(/[?&](?:imgurl|mediaurl|url)=([^&#]+)/i);
  if (g && /(google|bing)\./i.test(s)) { try { s = decodeURIComponent(g[1]); } catch (e) { /* giữ nguyên */ } }
  if (/^\/\//.test(s)) s = 'https:' + s;
  else if (/^http:\/\//i.test(s)) s = 'https://' + s.slice(7);
  else if (!/^https:\/\//i.test(s) && /^[\w-]+(\.[\w-]+)+/.test(s)) s = 'https://' + s;
  if (!/^https:\/\/[^\s]+$/i.test(s)) {
    throw new Error('Không nhận ra link ảnh. Hãy mở ảnh trên trang web, bấm chuột phải → "Sao chép địa chỉ hình ảnh" rồi dán lại; hoặc tải ảnh về máy và bấm "Chọn ảnh".');
  }
  if (s.length > 1500) throw new Error('Link ảnh quá dài. Hãy tải ảnh về máy rồi bấm "Chọn ảnh".');
  return { link: s };
}

function thuMucAnh_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ANH_FOLDER_ID');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* tạo lại */ } }
  let ten = 'Ảnh món – Quản lý quán cafe';
  try { ten = 'Ảnh món – ' + ss_().getName(); } catch (e) { /* bỏ qua */ }
  const f = DriveApp.createFolder(ten);
  props.setProperty('ANH_FOLDER_ID', f.getId());
  return f;
}

function luuAnhDrive_(anh, tenMon) {
  const b64 = String(anh.base64 || '').replace(/^data:[^,]+,/, '');
  if (b64.length > 5 * 1024 * 1024) throw new Error('Ảnh quá lớn (tối đa khoảng 3,5MB).');
  const mime = /^image\/(jpeg|png|webp|gif)$/.test(anh.mimeType) ? anh.mimeType : 'image/jpeg';
  const duoi = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[mime];
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, khongDauMa_(tenMon).toLowerCase() + '_' + Date.now() + '.' + duoi);
    const file = thuMucAnh_().createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
    catch (e) { throw new Error('Đã lưu ảnh nhưng không chia sẻ công khai được (tài khoản Google Workspace có thể chặn). Hãy dán link ảnh thay thế.'); }
    return 'https://lh3.googleusercontent.com/d/' + file.getId();
  } catch (e) {
    if (/quyền|permission|authoriz/i.test(e.message)) {
      throw new Error('Ứng dụng chưa được cấp quyền Google Drive. Chủ quán hãy mở Apps Script, chạy hàm capQuyenDrive rồi triển khai lại phiên bản mới.');
    }
    throw e;
  }
}

function xoaAnhDrive_(url) {
  const m = String(url).match(/lh3\.googleusercontent\.com\/d\/([\w-]+)|[?&]id=([\w-]+)/);
  if (!m) return;
  try {
    const f = DriveApp.getFileById(m[1] || m[2]);
    const thuMuc = PropertiesService.getScriptProperties().getProperty('ANH_FOLDER_ID');
    const parents = f.getParents();
    while (parents.hasNext()) { if (parents.next().getId() === thuMuc) { f.setTrashed(true); return; } }
  } catch (e) { console.error('xoaAnhDrive_: ' + e); }
}

/** Chạy một lần trong Apps Script để cấp quyền Google Drive (lưu ảnh món). */
function capQuyenDrive() {
  const f = thuMucAnh_();
  const msg = 'Đã cấp quyền Google Drive. Ảnh món được lưu trong thư mục: "' + f.getName() + '"\n' + f.getUrl() +
    '\n\nNhớ vào Triển khai → Quản lý các bản triển khai → Phiên bản mới.';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* chạy trong trình soạn thảo */ }
  return msg;
}

/* ============================ BÁO CÁO & PHÂN TÍCH ============================ */

function ngayCong_(s, n) {
  const p = String(s).split('-');
  const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
  return d.toISOString().slice(0, 10);
}
function soNgayGiua_(tu, den) {
  const a = tu.split('-'), b = den.split('-');
  return Math.round((Date.UTC(+b[0], +b[1] - 1, +b[2]) - Date.UTC(+a[0], +a[1] - 1, +a[2])) / 864e5) + 1;
}
function thuTrongTuan_(s) { const p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay(); }

/**
 * Báo cáo bán hàng theo kỳ. dl = {tuNgay:'yyyy-MM-dd', denNgay, maChiNhanh ('' = tất cả, chỉ chủ quán)}
 * Doanh thu = tổng tiền khách trả của hóa đơn ĐÃ THANH TOÁN, tính theo ngày bán.
 * Giá vốn = số lượng × giá vốn định mức lưu trên từng dòng bán (chưa phải giá vốn thực tế từ kho).
 */
function baoCao(token, dl) {
  const p = phien_(token, { khongCanChiNhanh: true });
  yeuCau_(p, [VT.CHU_QUAN, VT.QUAN_LY]);
  dl = dl || {};
  const re = /^\d{4}-\d{2}-\d{2}$/;
  let tu = re.test(dl.tuNgay) ? dl.tuNgay : homNay_();
  let den = re.test(dl.denNgay) ? dl.denNgay : tu;
  if (tu > den) { const t = tu; tu = den; den = t; }
  const soNgay = soNgayGiua_(tu, den);
  if (soNgay > 366) throw new Error('Mỗi lần xem tối đa 366 ngày.');
  const laCQ = p.VAI_TRO === VT.CHU_QUAN;
  const dsCN = docBang_('DM_CHINHANH');
  let cn = laCQ ? String(dl.maChiNhanh || '') : p.MA_CHI_NHANH;
  if (cn && !dsCN.some(function (c) { return c.MA_CHI_NHANH === cn; })) throw new Error('Chi nhánh không hợp lệ.');
  const truocDen = ngayCong_(tu, -1), truocTu = ngayCong_(tu, -soNgay);

  const ngayHD = function (h) { return String(h.NGAY_BAN).slice(0, 10); };
  const hdAll = docDongLoc_('BH_HOADON', 'NGAY_BAN', function (v) { const n = String(v).slice(0, 10); return n >= truocTu && n <= den; }, ngayTruoc_(truocTu))
    .filter(function (h) { return !cn || h.MA_CHI_NHANH === cn; });
  const hdMap = {};
  hdAll.forEach(function (h) { hdMap[h.MA_HOA_DON] = h; });
  const ctTheoHD = {};
  docDongLoc_('BH_CHITIETHOADON', 'MA_HOA_DON', function (v) { return hdMap[v]; }, hdTruocNgay_(truocTu)).forEach(function (c) {
    (ctTheoHD[c.MA_HOA_DON] = ctTheoHD[c.MA_HOA_DON] || []).push(c);
  });

  // Giá vốn và tỷ lệ phân bổ giảm giá cho từng hóa đơn
  const vonHD = {};
  hdAll.forEach(function (h) {
    let v = 0;
    (ctTheoHD[h.MA_HOA_DON] || []).forEach(function (c) { if (c.TRANG_THAI !== TT.CT_DA_HUY) v += so_(c.SO_LUONG) * so_(c.GIA_VON); });
    vonHD[h.MA_HOA_DON] = Math.round(v);
  });

  function tongHop(tuN, denN) {
    const ds = hdAll.filter(function (h) { const n = ngayHD(h); return n >= tuN && n <= denN; });
    const tt = ds.filter(function (h) { return h.TRANG_THAI === TT.HD_DA_THANH_TOAN; });
    const r = { doanhThu: 0, tongTienHang: 0, giamGia: 0, giaVon: 0, soHoaDon: tt.length, soMon: 0,
      hoaDonHuy: 0, dangPhucVu: 0, monHuy: 0, tienMonHuy: 0 };
    tt.forEach(function (h) {
      r.doanhThu += so_(h.TONG_THANH_TOAN); r.tongTienHang += so_(h.TONG_TIEN_HANG); r.giamGia += so_(h.TIEN_GIAM_GIA);
      r.giaVon += vonHD[h.MA_HOA_DON];
      (ctTheoHD[h.MA_HOA_DON] || []).forEach(function (c) { if (c.TRANG_THAI !== TT.CT_DA_HUY) r.soMon += so_(c.SO_LUONG); });
    });
    ds.forEach(function (h) {
      if (h.TRANG_THAI === TT.HD_DA_HUY) r.hoaDonHuy++;
      if (h.TRANG_THAI === TT.HD_DANG_PHUC_VU) r.dangPhucVu++;
      (ctTheoHD[h.MA_HOA_DON] || []).forEach(function (c) {
        if (c.TRANG_THAI === TT.CT_DA_HUY) { r.monHuy += so_(c.SO_LUONG); r.tienMonHuy += so_(c.THANH_TIEN); }
      });
    });
    r.laiGop = r.doanhThu - r.giaVon;
    r.giaTriTB = r.soHoaDon ? Math.round(r.doanhThu / r.soHoaDon) : 0;
    r.tyLeLaiGop = r.doanhThu ? r.laiGop / r.doanhThu : 0;
    return r;
  }

  const ky = hdAll.filter(function (h) { const n = ngayHD(h); return n >= tu && n <= den; });
  const daTT = ky.filter(function (h) { return h.TRANG_THAI === TT.HD_DA_THANH_TOAN; });
  const maTT = {};
  daTT.forEach(function (h) { maTT[h.MA_HOA_DON] = true; });

  // Theo ngày (đủ mọi ngày, kể cả ngày không bán)
  const theoNgayMap = {};
  for (let i = 0; i < soNgay; i++) { const n = ngayCong_(tu, i); theoNgayMap[n] = { ngay: n, doanhThu: 0, soHoaDon: 0, laiGop: 0 }; }
  const theoGio = []; for (let g = 0; g < 24; g++) theoGio.push({ gio: g, doanhThu: 0, soHoaDon: 0 });
  const theoThu = []; for (let t = 0; t < 7; t++) theoThu.push({ thu: t, doanhThu: 0, soHoaDon: 0, soNgay: 0 });
  Object.keys(theoNgayMap).forEach(function (n) { theoThu[thuTrongTuan_(n)].soNgay++; });
  const loaiDon = {}, theoNV = {}, theoThuNgan = {}, theoCN = {}, theoGiam = {};
  daTT.forEach(function (h) {
    const tien = so_(h.TONG_THANH_TOAN), lai = tien - vonHD[h.MA_HOA_DON];
    const d = theoNgayMap[ngayHD(h)];
    if (d) { d.doanhThu += tien; d.soHoaDon++; d.laiGop += lai; }
    const g = parseInt(String(h.GIO_BAN).slice(0, 2), 10);
    if (g >= 0 && g < 24) { theoGio[g].doanhThu += tien; theoGio[g].soHoaDon++; }
    const t = theoThu[thuTrongTuan_(ngayHD(h))]; t.doanhThu += tien; t.soHoaDon++;
    const l = h.LOAI_DON || LOAI_DON.TAI_BAN;
    loaiDon[l] = loaiDon[l] || { loai: l, soHoaDon: 0, doanhThu: 0 }; loaiDon[l].soHoaDon++; loaiDon[l].doanhThu += tien;
    const nv = h.MA_NHAN_VIEN || '?';
    theoNV[nv] = theoNV[nv] || { ma: nv, soHoaDon: 0, doanhThu: 0 }; theoNV[nv].soHoaDon++; theoNV[nv].doanhThu += tien;
    const c = h.MA_CHI_NHANH;
    theoCN[c] = theoCN[c] || { ma: c, soHoaDon: 0, doanhThu: 0, laiGop: 0 }; theoCN[c].soHoaDon++; theoCN[c].doanhThu += tien; theoCN[c].laiGop += lai;
    if (so_(h.TIEN_GIAM_GIA) > 0) {
      const k = h.MA_GIAM_GIA || 'Khác';
      theoGiam[k] = theoGiam[k] || { ma: k, soLan: 0, soTien: 0 }; theoGiam[k].soLan++; theoGiam[k].soTien += so_(h.TIEN_GIAM_GIA);
    }
  });

  // Theo món (doanh thu thuần = thành tiền sau khi phân bổ giảm giá của hóa đơn)
  const spDM = {};
  docBang_('DM_SANPHAM').forEach(function (s) { spDM[s.MA_SAN_PHAM] = s; });
  const nhomDM = {};
  docBang_('DM_NHOMSANPHAM').forEach(function (n) { nhomDM[n.MA_NHOM_SAN_PHAM] = n.TEN_NHOM_SAN_PHAM; });
  const theoMon = {};
  daTT.forEach(function (h) {
    const heSo = so_(h.TONG_TIEN_HANG) > 0 ? so_(h.TONG_THANH_TOAN) / so_(h.TONG_TIEN_HANG) : 0;
    (ctTheoHD[h.MA_HOA_DON] || []).forEach(function (c) {
      if (c.TRANG_THAI === TT.CT_DA_HUY) return;
      const ma = c.MA_SAN_PHAM, sp = spDM[ma];
      const m = theoMon[ma] = theoMon[ma] || { ma: ma, ten: sp ? sp.TEN_SAN_PHAM : c.TEN_SAN_PHAM, nhom: sp ? sp.MA_NHOM_SAN_PHAM : '',
        soLuong: 0, doanhThu: 0, giaVon: 0 };
      m.soLuong += so_(c.SO_LUONG);
      m.doanhThu += so_(c.THANH_TIEN) * heSo;
      m.giaVon += so_(c.SO_LUONG) * so_(c.GIA_VON);
    });
  });
  const dsMon = Object.keys(theoMon).map(function (k) {
    const m = theoMon[k]; m.doanhThu = Math.round(m.doanhThu); m.giaVon = Math.round(m.giaVon); m.laiGop = m.doanhThu - m.giaVon; return m;
  }).sort(function (a, b) { return b.doanhThu - a.doanhThu; });
  const theoNhom = {};
  dsMon.forEach(function (m) {
    const k = m.nhom || '';
    theoNhom[k] = theoNhom[k] || { ma: k, ten: nhomDM[k] || 'Khác', soLuong: 0, doanhThu: 0, laiGop: 0 };
    theoNhom[k].soLuong += m.soLuong; theoNhom[k].doanhThu += m.doanhThu; theoNhom[k].laiGop += m.laiGop;
  });
  const monChuaBan = Object.keys(spDM).filter(function (k) { return spDM[k].TRANG_THAI === TT.DANG_BAN && !theoMon[k]; })
    .map(function (k) { return { ma: k, ten: spDM[k].TEN_SAN_PHAM, nhom: nhomDM[spDM[k].MA_NHOM_SAN_PHAM] || '' }; });

  // Thanh toán
  const ptTen = {};
  docBang_('DM_PHUONGTHUCTHANHTOAN').forEach(function (x) { ptTen[x.MA_PHUONG_THUC] = x.TEN_PHUONG_THUC; });
  const theoPT = {};
  docDongLoc_('BH_THANHTOAN', 'MA_HOA_DON', function (v) { return maTT[v]; }, hdTruocNgay_(truocTu)).forEach(function (t) {
    const k = t.MA_PHUONG_THUC;
    theoPT[k] = theoPT[k] || { ma: k, ten: ptTen[k] || k, soTien: 0, soLan: 0 }; theoPT[k].soTien += so_(t.SO_TIEN); theoPT[k].soLan++;
    const n = t.NGUOI_THU || '?';
    theoThuNgan[n] = theoThuNgan[n] || { ma: n, soLan: 0, soTien: 0 }; theoThuNgan[n].soLan++; theoThuNgan[n].soTien += so_(t.SO_TIEN);
  });

  // Hủy (thất thoát) từ nhật ký thao tác
  const nvTen = {};
  docBang_('DM_NHANVIEN').forEach(function (n) { nvTen[n.MA_NHAN_VIEN] = n.TEN_NHAN_VIEN; });
  const banTen = {};
  docBang_('DM_BAN').forEach(function (b) { banTen[b.MA_BAN] = b.TEN_BAN; });
  const maKy = {};
  ky.forEach(function (h) { maKy[h.MA_HOA_DON] = h; });
  const huy = timDong_('BH_LICHSUHANG', 'LOAI_THAO_TAC', 'Hủy món').concat(timDong_('BH_LICHSUHANG', 'LOAI_THAO_TAC', 'Hủy hóa đơn')).filter(function (l) {
    return maKy[l.MA_HOA_DON];
  }).map(function (l) {
    const h = maKy[l.MA_HOA_DON];
    return { thoiGian: l.THOI_GIAN, loai: l.LOAI_THAO_TAC, maHoaDon: l.MA_HOA_DON,
      noi: h.LOAI_DON === LOAI_DON.MANG_DI ? 'Mang đi' : (banTen[h.MA_BAN] || h.MA_BAN || ''),
      noiDung: l.NOI_DUNG, nguoi: nvTen[l.NGUOI_THUC_HIEN] || l.NGUOI_THUC_HIEN };
  }).sort(function (a, b) { return String(a.thoiGian) < String(b.thoiGian) ? 1 : -1; }).slice(0, 300);

  const cnTen = {};
  dsCN.forEach(function (c) { cnTen[c.MA_CHI_NHANH] = c.TEN_CHI_NHANH; });
  const sapGiam = function (k) { return function (a, b) { return b[k] - a[k]; }; };
  const giaTri = function (o) { return Object.keys(o).map(function (k) { return o[k]; }); };
  return {
    tuNgay: tu, denNgay: den, soNgay: soNgay, truocTu: truocTu, truocDen: truocDen,
    maChiNhanh: cn, tenChiNhanh: cn ? cnTen[cn] : 'Tất cả chi nhánh', laChuQuan: laCQ,
    chiNhanh: laCQ ? dsCN.map(function (c) { return { ma: c.MA_CHI_NHANH, ten: c.TEN_CHI_NHANH }; }) : [],
    tongQuan: tongHop(tu, den),
    kyTruoc: tongHop(truocTu, truocDen),
    theoNgay: giaTri(theoNgayMap).map(function (d) { d.laiGop = Math.round(d.laiGop); return d; }),
    theoGio: theoGio, theoThu: theoThu,
    theoMon: dsMon, theoNhom: giaTri(theoNhom).sort(sapGiam('doanhThu')), monChuaBan: monChuaBan,
    theoPhuongThuc: giaTri(theoPT).sort(sapGiam('soTien')),
    theoLoaiDon: giaTri(loaiDon).sort(sapGiam('doanhThu')),
    theoNhanVien: giaTri(theoNV).map(function (x) { x.ten = nvTen[x.ma] || x.ma; return x; }).sort(sapGiam('doanhThu')),
    theoThuNgan: giaTri(theoThuNgan).map(function (x) { x.ten = nvTen[x.ma] || x.ma; return x; }).sort(sapGiam('soTien')),
    theoChiNhanh: cn ? [] : giaTri(theoCN).map(function (x) { x.ten = cnTen[x.ma] || x.ma; x.laiGop = Math.round(x.laiGop); return x; }).sort(sapGiam('doanhThu')),
    theoGiamGia: giaTri(theoGiam).sort(sapGiam('soTien')),
    huy: huy
  };
}
