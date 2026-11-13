require("dotenv").config();
const { auth } = require("./src/config/firebaseAdmin"); // Đảm bảo đường dẫn này đúng với cấu trúc thư mục của bạn

(async () => {
  try {
    // Nhớ thay UID thật vào giữa 2 dấu nháy đơn nhé!
    // Quy trình mới:
    // - giup_viec: Bộ phận giúp việc (soạn thảo, bóc tách, phân chỉ tiêu, đẩy xác nhận)
    // - thuong_truc: Thường trực HĐND (ký ban hành, xác nhận hoàn thành)
    // - co_quan_thuc_hien: Các ban/đơn vị thực hiện (nhận chỉ tiêu, báo cáo)
    await auth.setCustomUserClaims("si6EV9KuYAdVFXjY8kc42AVbEWC2", {
      role: "giup_viec",
      departmentId: "hdnd",
    });
    await auth.setCustomUserClaims("7FfMn9ENuJPjJn2DlZONKKzAVNf2", {
      role: "thuong_truc",
      departmentId: "thuong-truc",
    });
    await auth.setCustomUserClaims("tifL1lsso4fzI3cUH5IhDB9o1V43", {
      role: "co_quan_thuc_hien",
      departmentId: "ubnd-xa",
    });
    await auth.setCustomUserClaims("GdVoE4U46VZ6z3WezYHKYi08U9p2", {
      role: "ban_hdnd",
      departmentId: "ban-kinh-te",
    });

    console.log("✅ XONG! Đã gán quyền theo quy trình mới (giup_viec, thuong_truc, ...).");
    console.log("ℹ️  Lưu ý: role cũ 'chuyen_vien' vẫn được hệ thống tự nhận diện là 'giup_viec'.");
    process.exit(0);
  } catch (error) {
    console.error("❌ LỖI:", error);
    process.exit(1);
  }
})();
