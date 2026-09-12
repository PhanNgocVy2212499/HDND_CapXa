require("dotenv").config();
const { auth } = require("./src/config/firebaseAdmin"); // Đảm bảo đường dẫn này đúng với cấu trúc thư mục của bạn

(async () => {
  try {
    // Nhớ thay UID thật vào giữa 2 dấu nháy đơn nhé!
    await auth.setCustomUserClaims("si6EV9KuYAdVFXjY8kc42AVbEWC2", {
      role: "chuyen_vien",
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

    console.log("✅ XONG! Đã gán quyền thành công cho cả 4 users.");
    process.exit(0);
  } catch (error) {
    console.error("❌ LỖI:", error);
    process.exit(1);
  }
})();
