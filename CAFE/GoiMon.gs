/***********************************************************************
 * KHÁCH GỌI MÓN BẰNG MÃ QR TẠI BÀN
 * - Trang của khách đặt trên GitHub Pages (thư mục goi-mon), KHÔNG chạy trên trang Apps Script.
 * - Trang đó gọi API JSON của Web App này:
 *     GET  ?api=menu&b=<mã bàn>&k=<khóa bàn>          → thực đơn, thông tin quán, đơn đang mở của bàn
 *     GET  ?api=tt&b=&k=&ma=<YC1,YC2>                 → trạng thái các yêu cầu đã gửi
 *     POST {api:'dat', b, k, loai, items, ghiChu, ten} → gửi yêu cầu (gọi món / gọi nhân viên / xin thanh toán)
 * - Khóa bàn k = HMAC(mã bàn, khóa bí mật) nên khách không tự đoán được mã QR của bàn khác.
 *   Đổi khóa bí mật (Quản trị) → mọi mã QR cũ mất hiệu lực, cần in lại.
 * - Yêu cầu lưu ở bảng BH_YEUCAU; nhân viên xác nhận trên ứng dụng (hoặc gửi thẳng pha chế tùy cấu hình).
 ***********************************************************************/

const YC = {
  LOAI: { GOI_MON: 'Gọi món', GOI_NV: 'Gọi nhân viên', THANH_TOAN: 'Xin thanh toán' },
  CHO: 'Chờ xác nhận', DANG_XU_LY: 'Đang xử lý', DA_NHAN: 'Đã xác nhận', XONG: 'Đã xử lý', TU_CHOI: 'Từ chối'
};
const GOI_MON_CHE_DO = { XAC_NHAN: 'Nhân viên xác nhận', TU_DONG: 'Gửi thẳng quầy pha chế', TAT: 'Tắt' };

/* ---------------------------- API JSON ---------------------------- */

function traJson_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Trang khách gửi POST dạng text/plain (tránh bước kiểm tra CORS của trình duyệt). */
function doPost(e) {
  let dl = {};
  try { dl = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return traJson_({ ok: false, loi: 'Dữ liệu gửi lên không hợp lệ.' }); }
  return traJson_(apiKhach_(dl));
}

function apiKhach_(dl) {
  try {
    const api = String(dl.api || '');
    if (api === 'menu') return { ok: true, v: khachMenu_(dl) };
    if (api === 'tt') return { ok: true, v: khachTrangThai_(dl) };
    if (api === 'dat') return { ok: true, v: khachDat_(dl) };
    return { ok: false, loi: 'Yêu cầu không hợp lệ.' };
  } catch (e) {
    return { ok: false, loi: String(e.message || e).replace(/^Error:\s*/, '') };
  }
}

/* ---------------------------- KHÓA BÀN ---------------------------- */

function khoaBiMat_() {
  const props = PropertiesService.getScriptProperties();
  let k = props.getProperty('KHOA_QR_BAN');
  if (!k) { k = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); props.setProperty('KHOA_QR_BAN', k); }
  return k;
}
function khoaBan_(maBan) {
  return hex_(Utilities.computeHmacSha256Signature(String(maBan), khoaBiMat_())).slice(0, 12);
}

/** Kiểm tra mã QR; trả về {ban, cn, cheDo} */
function banTuQR_(dl) {
  const maBan = String(dl.b || '').trim(), k = String(dl.k || '').trim();
  if (!maBan || !k || k !== khoaBan_(maBan)) throw new Error('Mã QR không hợp lệ hoặc đã hết hiệu lực. Vui lòng báo nhân viên.');
  const ban = timDong_('DM_BAN', 'MA_BAN', maBan)[0];
  if (!ban || ban.TRANG_THAI === TT.NGUNG) throw new Error('Bàn này hiện không phục vụ. Vui lòng báo nhân viên.');
  const cn = docBang_('DM_CHINHANH').filter(function (c) { return c.MA_CHI_NHANH === ban.MA_CHI_NHANH; })[0];
  if (!cn || cn.TRANG_THAI === TT.NGUNG) throw new Error('Chi nhánh hiện không phục vụ.');
  const q = thongTinQuanAnToan_();
  const cheDo = q.GOI_MON_KHACH || GOI_MON_CHE_DO.XAC_NHAN;
  if (cheDo === GOI_MON_CHE_DO.TAT) throw new Error('Quán đang tạm tắt gọi món qua mã QR. Vui lòng gọi nhân viên.');
  return { ban: ban, cn: cn, cheDo: cheDo, q: q };
}

/* ---------------------------- KHÁCH ---------------------------- */

function donCuaBan_(cn, maBan) {
  const h = dangMo_(cn).filter(function (x) { return x.MA_BAN === maBan && x.LOAI_DON === LOAI_DON.TAI_BAN; })[0];
  if (!h) return null;
  const ct = timDong_('BH_CHITIETHOADON', 'MA_HOA_DON', h.MA_HOA_DON).filter(function (c) { return c.TRANG_THAI !== TT.CT_DA_HUY; });
  return {
    MA_HOA_DON: h.MA_HOA_DON, GIO_BAN: h.GIO_BAN,
    TONG_TIEN_HANG: so_(h.TONG_TIEN_HANG), TIEN_GIAM_GIA: so_(h.TIEN_GIAM_GIA),
    TONG_THANH_TOAN: so_(h.TONG_THANH_TOAN), DA_THANH_TOAN: so_(h.DA_THANH_TOAN),
    mon: ct.map(function (c) {
      return { TEN: c.TEN_SAN_PHAM, SL: so_(c.SO_LUONG), TIEN: so_(c.THANH_TIEN), GHI_CHU: c.GHI_CHU || '',
        XONG: c.TRANG_THAI_PHA_CHE === TT.PC_XONG };
    })
  };
}

function khachMenu_(dl) {
  const x = banTuQR_(dl), cnMa = x.ban.MA_CHI_NHANH;
  const khoa = 'DMKT|' + cnMa + '|' + homNay_();
  let dm = docDem_(khoa);
  if (!dm) { dm = danhMucBanHang_(cnMa); ghiDem_(khoa, dm, 300); }
  const q = x.q;
  const kv = docBang_('DM_KHUVUC').filter(function (k) { return k.MA_KHU_VUC === x.ban.MA_KHU_VUC; })[0];
  return {
    quan: { TEN_QUAN: q.TEN_QUAN, SLOGAN: q.SLOGAN, LOGO: q.LOGO, WIFI: q.WIFI, SO_DIEN_THOAI: x.cn.SO_DIEN_THOAI || q.SO_DIEN_THOAI,
      MA_NGAN_HANG: q.MA_NGAN_HANG, NGAN_HANG: q.NGAN_HANG, SO_TAI_KHOAN: q.SO_TAI_KHOAN, CHU_TAI_KHOAN: q.CHU_TAI_KHOAN },
    ban: { MA_BAN: x.ban.MA_BAN, TEN_BAN: x.ban.TEN_BAN, KHU_VUC: kv ? kv.TEN_KHU_VUC : '', TEN_CHI_NHANH: x.cn.TEN_CHI_NHANH, DIA_CHI: x.cn.DIA_CHI || '' },
    cheDo: x.cheDo,
    nhom: dm.nhom,
    sanPham: dm.sanPham,
    don: donCuaBan_(cnMa, x.ban.MA_BAN)
  };
}

function khachTrangThai_(dl) {
  const x = banTuQR_(dl);
  const ma = String(dl.ma || '').split(',').map(function (s) { return s.trim(); }).filter(String).slice(0, 20);
  const ds = ma.length ? timNhieuDong_('BH_YEUCAU', 'MA_YEU_CAU', ma).filter(function (r) { return r.MA_BAN === x.ban.MA_BAN; }) : [];
  return {
    yeuCau: ds.map(function (r) { return { MA_YEU_CAU: r.MA_YEU_CAU, LOAI: r.LOAI, TRANG_THAI: r.TRANG_THAI, LY_DO: r.LY_DO || '' }; }),
    don: donCuaBan_(x.ban.MA_CHI_NHANH, x.ban.MA_BAN)
  };
}

/** dl = {b, k, loai, items:[{ma, sl, gc}], ghiChu, ten} */
function khachDat_(dl) {
  const x = banTuQR_(dl);
  const loai = [YC.LOAI.GOI_MON, YC.LOAI.GOI_NV, YC.LOAI.THANH_TOAN].indexOf(dl.loai) >= 0 ? dl.loai : YC.LOAI.GOI_MON;
  // Chống gửi liên tục: mỗi bàn tối đa 8 yêu cầu / 5 phút
  const cache = CacheService.getScriptCache(), kGh = 'YCB_' + x.ban.MA_BAN;
  const dem = Number(cache.get(kGh)) || 0;
  if (dem >= 8) throw new Error('Bàn đã gửi nhiều yêu cầu liên tiếp. Vui lòng đợi vài phút hoặc gọi nhân viên.');

  let noiDung = [];
  if (loai === YC.LOAI.GOI_MON) {
    const sp = {};
    docBang_('DM_SANPHAM').forEach(function (s) { sp[s.MA_SAN_PHAM] = s; });
    const items = (dl.items || []).slice(0, 30);
    items.forEach(function (it) {
      const s = sp[it.ma];
      if (!s || s.TRANG_THAI !== TT.DANG_BAN) throw new Error('Món "' + (s ? s.TEN_SAN_PHAM : it.ma) + '" hiện đã hết. Vui lòng chọn món khác.');
      const sl = Math.floor(so_(it.sl));
      if (!(sl >= 1 && sl <= 20)) throw new Error('Số lượng món "' + s.TEN_SAN_PHAM + '" phải từ 1 đến 20.');
      noiDung.push({ ma: s.MA_SAN_PHAM, ten: s.TEN_SAN_PHAM, sl: sl, gia: so_(s.GIA_BAN), gc: String(it.gc || '').trim().slice(0, 100) });
    });
    if (!noiDung.length) throw new Error('Bạn chưa chọn món nào.');
  } else if (loai === YC.LOAI.THANH_TOAN) {
    const pt = String(dl.phuongThuc || '').slice(0, 30);
    noiDung = pt ? [{ phuongThuc: pt }] : [];
  }
  const ghiChu = String(dl.ghiChu || '').trim().slice(0, 200);
  const ten = String(dl.ten || '').trim().slice(0, 40);

  const ma = voiKhoa_(function () {
    const now = new Date();
    const ma = 'YC' + Utilities.formatDate(now, MUI_GIO, 'yyMMdd') + dem_(soTiepTheo_('YC|' + Utilities.formatDate(now, MUI_GIO, 'yyMMdd')), 4);
    themDong_('BH_YEUCAU', [{
      MA_YEU_CAU: ma, MA_CHI_NHANH: x.ban.MA_CHI_NHANH, MA_BAN: x.ban.MA_BAN, LOAI: loai, NOI_DUNG: JSON.stringify(noiDung),
      GHI_CHU: ghiChu, TEN_KHACH: ten, TRANG_THAI: YC.CHO, THOI_GIAN: now, NGUOI_XU_LY: '', THOI_GIAN_XU_LY: '', MA_HOA_DON: '', LY_DO: ''
    }]);
    return ma;
  });
  cache.put(kGh, String(dem + 1), 300);
  // Chế độ gửi thẳng: món đi luôn quầy pha chế (gọi nhân viên / xin thanh toán vẫn chờ nhân viên)
  if (loai === YC.LOAI.GOI_MON && x.cheDo === GOI_MON_CHE_DO.TU_DONG) {
    try { xuLyYeuCau_({ MA_NHAN_VIEN: 'KHACH_QR', MA_CHI_NHANH: x.ban.MA_CHI_NHANH, VAI_TRO: VT.PHUC_VU }, ma, true, ''); }
    catch (e) { console.error('Tự gửi món khách: ' + e); }
  }
  return { MA_YEU_CAU: ma, TRANG_THAI: timDong_('BH_YEUCAU', 'MA_YEU_CAU', ma)[0].TRANG_THAI };
}

/* ---------------------------- NHÂN VIÊN ---------------------------- */

function yeuCauDangCho_(cn) {
  const banMap = {};
  docBang_('DM_BAN').forEach(function (b) { banMap[b.MA_BAN] = b.TEN_BAN; });
  return timDong_('BH_YEUCAU', 'TRANG_THAI', YC.CHO).filter(function (r) { return r.MA_CHI_NHANH === cn; })
    .map(function (r) {
      let nd = [];
      try { nd = JSON.parse(r.NOI_DUNG || '[]'); } catch (e) { /* bỏ qua */ }
      return { MA_YEU_CAU: r.MA_YEU_CAU, MA_BAN: r.MA_BAN, TEN_BAN: banMap[r.MA_BAN] || r.MA_BAN, LOAI: r.LOAI, NOI_DUNG: nd,
        GHI_CHU: r.GHI_CHU || '', TEN_KHACH: r.TEN_KHACH || '', THOI_GIAN: r.THOI_GIAN };
    }).sort(function (a, b) { return String(a.THOI_GIAN) < String(b.THOI_GIAN) ? -1 : 1; });
}

function layYeuCauKhach(token) {
  const p = phien_(token);
  yeuCau_(p, NHOM_QUYEN.BAN_HANG);
  return yeuCauDangCho_(p.MA_CHI_NHANH);
}

/** Gói theo dõi định kỳ cho ứng dụng nhân viên: món chờ pha chế và/hoặc yêu cầu của khách, trong một lượt gọi. */
function theoDoi(token, can) {
  const p = phien_(token);
  can = can || {};
  const kq = {};
  if (can.phaChe && NHOM_QUYEN.PHA_CHE.indexOf(p.VAI_TRO) >= 0) kq.pc = phaChe_(p);
  if (can.yeuCau && NHOM_QUYEN.BAN_HANG.indexOf(p.VAI_TRO) >= 0) kq.yc = yeuCauDangCho_(p.MA_CHI_NHANH);
  return kq;
}

/** dongY = true: gọi món → gửi vào hóa đơn của bàn (tự tạo nếu chưa có); loại khác → đánh dấu đã xử lý. */
function xuLyYeuCauKhach(token, maYC, dongY, lyDo) {
  const p = phien_(token);
  yeuCau_(p, NHOM_QUYEN.BAN_HANG);
  xuLyYeuCau_(p, maYC, !!dongY, lyDo);
  return yeuCauDangCho_(p.MA_CHI_NHANH);
}

function xuLyYeuCau_(p, maYC, dongY, lyDo) {
  // Bước 1: giữ yêu cầu (tránh hai nhân viên cùng xác nhận một yêu cầu)
  const r = voiKhoa_(function () {
    const r = timDong_('BH_YEUCAU', 'MA_YEU_CAU', maYC)[0];
    if (!r || r.MA_CHI_NHANH !== p.MA_CHI_NHANH) throw new Error('Không tìm thấy yêu cầu.');
    if (r.TRANG_THAI !== YC.CHO) throw new Error('Yêu cầu đã được người khác xử lý (' + r.TRANG_THAI + ').');
    capNhat_('BH_YEUCAU', r._row, { TRANG_THAI: dongY && r.LOAI === YC.LOAI.GOI_MON ? YC.DANG_XU_LY : (dongY ? YC.XONG : YC.TU_CHOI),
      NGUOI_XU_LY: p.MA_NHAN_VIEN, THOI_GIAN_XU_LY: new Date(), LY_DO: dongY ? '' : String(lyDo || '').slice(0, 200) });
    return r;
  });
  if (!(dongY && r.LOAI === YC.LOAI.GOI_MON)) return true;
  // Bước 2: gửi món vào hóa đơn của bàn
  let nd = [];
  try { nd = JSON.parse(r.NOI_DUNG || '[]'); } catch (e) { /* bỏ qua */ }
  let ct;
  try {
    ct = guiMon_(p, { loaiDon: LOAI_DON.TAI_BAN, maBan: r.MA_BAN, ghiChu: '',
      items: nd.map(function (m) { return { maSanPham: m.ma, soLuong: m.sl, ghiChu: m.gc || '' }; }),
      nguon: 'Khách gọi qua QR' + (r.TEN_KHACH ? ' (' + r.TEN_KHACH + ')' : '') + (r.GHI_CHU ? ' – ' + r.GHI_CHU : '') });
  } catch (e) {
    voiKhoa_(function () { capNhat_('BH_YEUCAU', r._row, { TRANG_THAI: YC.CHO, NGUOI_XU_LY: '', THOI_GIAN_XU_LY: '' }); });
    throw e;
  }
  voiKhoa_(function () { capNhat_('BH_YEUCAU', r._row, { TRANG_THAI: YC.DA_NHAN, MA_HOA_DON: ct.hoaDon.MA_HOA_DON }); });
  return true;
}

/* ---------------------------- QUẢN TRỊ: MÃ QR ---------------------------- */

/** Danh sách link QR của các bàn trong chi nhánh, để in. */
function qtLayQRBan(token, cn) {
  const p = phien_(token, { khongCanChiNhanh: true });
  yeuCau_(p, [VT.CHU_QUAN, VT.QUAN_LY]);
  cn = chiNhanhQuanLy_(p, cn);
  const q = thongTinQuanAnToan_();
  let goc = String(q.LINK_GOI_MON || '').trim();
  if (!goc) throw new Error('Chưa khai báo "Link trang gọi món" trong Quản trị → Thông tin quán.');
  if (!/^https:\/\//i.test(goc)) goc = 'https://' + goc.replace(/^http:\/\//i, '');
  goc = goc.replace(/[?#].*$/, '');
  if (!/\/$/.test(goc) && !/\.html?$/i.test(goc)) goc += '/';
  const kvMap = {};
  docBang_('DM_KHUVUC').forEach(function (k) { kvMap[k.MA_KHU_VUC] = k; });
  return {
    tenQuan: q.TEN_QUAN, cheDo: q.GOI_MON_KHACH || GOI_MON_CHE_DO.XAC_NHAN,
    ban: docBang_('DM_BAN').filter(function (b) { return b.MA_CHI_NHANH === cn && b.TRANG_THAI !== TT.NGUNG; })
      .sort(function (a, b) {
        const ka = kvMap[a.MA_KHU_VUC], kb = kvMap[b.MA_KHU_VUC];
        return (ka ? so_(ka.THU_TU) : 99) - (kb ? so_(kb.THU_TU) : 99) || so_(a.THU_TU) - so_(b.THU_TU);
      })
      .map(function (b) {
        return { MA_BAN: b.MA_BAN, TEN_BAN: b.TEN_BAN, KHU_VUC: kvMap[b.MA_KHU_VUC] ? kvMap[b.MA_KHU_VUC].TEN_KHU_VUC : '',
          LINK: goc + '?b=' + encodeURIComponent(b.MA_BAN) + '&k=' + khoaBan_(b.MA_BAN) };
      })
  };
}

/** Đổi khóa bí mật: mọi mã QR đã in mất hiệu lực (dùng khi lộ mã, khách nghịch phá). */
function qtDoiKhoaQR(token, cn) {
  const p = phien_(token, { khongCanChiNhanh: true });
  yeuCau_(p, [VT.CHU_QUAN]);
  PropertiesService.getScriptProperties().deleteProperty('KHOA_QR_BAN');
  return qtLayQRBan(token, cn);
}
