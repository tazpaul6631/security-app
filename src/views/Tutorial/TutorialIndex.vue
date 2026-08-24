<template>
  <div class="tutorial-page">
    <header class="route-header">
      <button type="button" class="route-back-btn" :aria-label="$t('routes.go-home')" @click="router.replace('/home')">
        <i class="pi pi-arrow-left route-back-icon" aria-hidden="true" />
        <span class="route-title">{{ $t('page.tutorial') }}</span>
      </button>
    </header>

    <AppPageContent class="tutorial-content">
      <div class="tutorial-bg" aria-hidden="true">
        <span class="tutorial-blob tutorial-blob-green" />
        <span class="tutorial-blob tutorial-blob-purple" />
      </div>

      <div class="tutorial-body">
        <div class="tutorial-intro">
          <h2>Cẩm nang Tuần tra</h2>
        </div>

        <Accordion multiple class="tutorial-accordion">
          <AccordionPanel value="start">
            <AccordionHeader>1. Bắt đầu ca trực</AccordionHeader>
            <AccordionContent>
              <div class="accordion-content-bg">
                <Card class="step-card">
                  <template #title>
                    <span class="step-title">Bước 1: Đăng nhập</span>
                  </template>
                  <template #content>
                    <p class="step-body">
                      Đầu tiên nhấn nút <strong class="text-success">QUÉT</strong> để quét mã vạch nhân viên
                      sau đó sẽ nhập mật khẩu và bấm <strong>ĐĂNG NHẬP</strong>.
                    </p>
                    <img src="/src/assets/images/tutorial/0.png" alt="login" />
                  </template>
                </Card>
              </div>
            </AccordionContent>
          </AccordionPanel>

          <AccordionPanel value="scan">
            <AccordionHeader>2. Quét điểm tuần tra</AccordionHeader>
            <AccordionContent>
              <div class="accordion-content-bg">
                <Card class="step-card">
                  <template #title>
                    <span class="step-title">Bước 1: Điểm tuần tra theo ca</span>
                  </template>
                  <template #content>
                    <p class="step-body">
                      Màn hình hiển thị danh sách các điểm cần tuần tra (Ví dụ: Cửa sổ 2 kéo lụa, Server
                      Room...). Sau đó bấm <strong class="text-success">QUÉT</strong> để bắt đầu quét điểm
                      tuần tra.
                    </p>
                    <img src="/src/assets/images/tutorial/11.png" alt="Lộ trình" />
                  </template>
                </Card>

                <Card class="step-card">
                  <template #title>
                    <span class="step-title">Bước 2: Quét mã QR</span>
                  </template>
                  <template #content>
                    <p class="step-body">
                      Nếu scan sai sẽ hiện thông báo có <strong class="text-danger"> Vị trí tô đỏ </strong>
                      và trở lại tìm đúng vị trí chính xác để scan lại.
                    </p>
                    <img src="/src/assets/images/tutorial/13.png" alt="Lưu ý phím cứng" />
                  </template>
                </Card>
              </div>
            </AccordionContent>
          </AccordionPanel>

          <AccordionPanel value="report">
            <AccordionHeader>3. Ghi nhận &amp; Báo cáo sự cố</AccordionHeader>
            <AccordionContent>
              <div class="accordion-content-bg">
                <Card class="step-card">
                  <template #title>
                    <span class="step-title">Bước 1: Trang báo cáo</span>
                  </template>
                  <template #content>
                    <p class="step-body">
                      Thẻ đầu tiên là thông tin khu vực: (thời gian tổng ca đếm ngược <strong class="text-success">màu
                        xanh</strong> và 15p cuối chuyển màu
                      <strong class="text-danger">màu đỏ</strong>, tên khu vực, ca + mã trực...). Phải nhấn
                      nút <strong>CHỤP</strong> điểm tuần tra trước khi có thể báo cáo sự cố.
                    </p>
                    <img src="/src/assets/images/tutorial/14.png" alt="Phát hiện lỗi có/không" />
                  </template>
                </Card>

                <Card class="step-card">
                  <template #title>
                    <span class="step-title">Bước 2: Nếu điểm tuần tra không vấn đề</span>
                  </template>
                  <template #content>
                    <p class="step-body">
                      Sau khi bấm <strong>CHỤP</strong> xong sẽ hiển thị ảnh đã chụp ở điểm tuần tra đó và có
                      thêm thời gian màu vàng cụ thể trên hình đó nếu lố qua ca sau sẽ hiện thời gian đó nhưng
                      là màu đỏ. Nếu không có vấn đề gì thì có thể ghi chú lại hoặc chụp một tấm hình nào đó
                      và bấm <strong class="text-success">GỬI BÁO CÁO</strong> để hoàn tất báo cáo.
                    </p>
                    <img src="/src/assets/images/tutorial/15.png" alt="Chọn tình trạng" />
                  </template>
                </Card>

                <Card class="step-card">
                  <template #title>
                    <span class="step-title">Bước 3: Nếu chọn có vấn đề</span>
                  </template>
                  <template #content>
                    <p class="step-body">
                      Bấm vào nút <strong>CHỌN TÌNH TRẠNG</strong> vừa xuất hiện sẽ hiện nơi để chọn loại sự
                      cố. Nếu đã chọn có vấn đề nhưng không chọn loại sự cố và không gửi ảnh của sự cố đó sẽ
                      có <strong class="text-warning">thông báo màu vàng</strong> và không <strong
                        class="text-success">GỬI BÁO CÁO</strong>
                    </p>
                    <img src="/src/assets/images/tutorial/16.png" alt="Chọn tình trạng" />
                  </template>
                </Card>

                <Card class="step-card">
                  <template #title>
                    <span class="step-title">Bước 4: Chọn nhóm sự cố</span>
                  </template>
                  <template #content>
                    <p class="step-body">
                      Chọn nhóm danh mục lỗi tương ứng (Ví dụ: Nhấn mũi tên xuống ở mục <strong>Nước</strong>
                      &gt; Chọn <strong>Van</strong>).
                    </p>
                    <img src="/src/assets/images/tutorial/18.png" alt="Phân loại" />
                  </template>
                </Card>

                <Card class="step-card">
                  <template #title>
                    <span class="step-title">Bước 5: Tích chọn lỗi thực tế</span>
                  </template>
                  <template #content>
                    <p class="step-body">
                      Đánh dấu vào tình trạng bạn đang thấy (VD: <em>Không khóa, rò rỉ...</em>) hoặc nhập ghi
                      chú thêm. Sau đó bấm <strong>XÁC NHẬN</strong>.
                    </p>
                    <img src="/src/assets/images/tutorial/19.png" alt="Chi tiết lỗi" />
                  </template>
                </Card>

                <Card class="step-card">
                  <template #title>
                    <span class="step-title">Bước 6: Chụp ảnh sự cố</span>
                  </template>
                  <template #content>
                    <p class="step-body">
                      App sẽ yêu cầu chụp hình. Hãy hướng camera chụp rõ khu vực xảy ra sự cố (ổ khóa, vũng
                      nước...).<br />
                      Cuối cùng bấm đóng ở phía trên bên phải và bấm <strong class="text-success">GỬI BÁO
                        CÁO</strong> để hoàn tất.
                    </p>
                    <img src="/src/assets/images/tutorial/10.png" alt="Chụp ảnh hiện trường" />
                  </template>
                </Card>
              </div>
            </AccordionContent>
          </AccordionPanel>

          <AccordionPanel value="end">
            <AccordionHeader>4. Kết thúc &amp; Đồng bộ dữ liệu</AccordionHeader>
            <AccordionContent>
              <div class="accordion-content-bg">
                <Card class="step-card">
                  <template #title>
                    <span class="step-title">Hoàn thành ca tuần tra</span>
                  </template>
                  <template #content>
                    <p class="step-body">
                      Nếu offline thông tin sẽ được lưu lại hàng chờ sau khi bạn online lại sẽ tự động gửi dữ
                      liệu đi.
                      <br>
                      Các dữ liệu chờ sẽ được hiển thị rỏ trên máy: các <strong class="text-warning">CHẤM
                        TRÒN</strong> hoặc <strong class="text-warning">CHỮ OFFLINE KẾ BÊN DỮ LIỆU
                        ĐÓ</strong> màu vàng.
                      <br>
                      <strong class="text-warning">LƯU Ý:</strong>
                      <br>
                      <strong class="note-danger">*</strong> Chỉ khi nào online lại dữ liệu sẽ tự động được
                      gửi đi hết mới có thể logout.
                      <br>
                      <strong class="note-danger">*</strong> Sau khi hoàn thành ca hiện tại sẽ thấy ca đó đã
                      hoàn thành, nếu làm ca hiện tại bị lố qua ca sau thì sẽ thấy ca tiếp sau khi hoàn thành.
                      <br>
                      <strong class="note-danger">*</strong> Không được tắt app để tránh mất dữ liệu!
                    </p>
                    <img src="/src/assets/images/tutorial/44.png" alt="Hoàn thành" />
                  </template>
                </Card>
              </div>
            </AccordionContent>
          </AccordionPanel>
        </Accordion>
      </div>
    </AppPageContent>
  </div>
</template>

<script setup lang="ts">
import router from '@/router';
import AppPageContent from '@/components/AppPageContent.vue';
import { useHardwareBackButton } from '@/composables/useHardwareBackButton';
import {
  Accordion, AccordionContent, AccordionHeader, AccordionPanel, Card,
} from '@/plugins/primevue.components';

useHardwareBackButton(10, () => {
  router.replace('/home');
});
</script>

<style scoped>
.tutorial-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.route-header {
  min-height: 48px;
  padding: 4px 8px 4px 4px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.route-back-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 6px 8px;
  min-height: 44px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 10px;
  text-align: left;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
  font: inherit;
}

.route-back-btn:hover,
.route-back-btn:focus,
.route-back-btn:focus-visible,
.route-back-btn:active {
  background: transparent;
  outline: none;
  box-shadow: none;
}

.route-back-icon {
  flex-shrink: 0;
  font-size: 1rem;
  color: #334155;
}

.route-title {
  flex: 1;
  min-width: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.tutorial-content {
  padding: 16px;
}

.tutorial-bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.tutorial-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(40px);
  -webkit-filter: blur(40px);
  opacity: 0.9;
}

.tutorial-blob-green {
  width: 250px;
  height: 250px;
  background: #e3f7ac;
  top: 20%;
  right: -50px;
}

.tutorial-blob-purple {
  width: 250px;
  height: 250px;
  background: #cac2e9;
  bottom: 10%;
  left: -80px;
}

.tutorial-body {
  position: relative;
  z-index: 1;
}

.tutorial-intro {
  text-align: center;
  margin-bottom: 20px;
}

.tutorial-intro h2 {
  font-size: 1.6rem;
  font-weight: 800;
  color: #0ea5e9;
  margin: 0;
  text-transform: uppercase;
}

.tutorial-accordion :deep(.p-accordionheader) {
  background: #64748b;
  color: #ffffff;
  font-weight: 700;
  font-size: 1.05rem;
}

.tutorial-accordion :deep(.p-accordioncontent-content) {
  padding: 0;
}

.accordion-content-bg {
  background-color: #eef2f5;
  padding: 16px 12px 8px;
}

.step-card {
  margin: 0 0 16px 0;
  border-radius: 16px;
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
  background: #ffffff;
  overflow: hidden;
}

.step-card img {
  width: 100%;
  max-height: 450px;
  object-fit: contain;
  background-color: #2c2c2c;
  display: block;
  border-bottom: 3px solid #0ea5e9;
}

.step-title {
  font-size: 1.15rem;
  font-weight: 800;
  color: #222;
}

.step-body {
  font-size: 1rem;
  line-height: 1.6;
  color: #444;
  margin: 0 0 12px;
}

.step-body strong {
  color: #0ea5e9;
  background-color: rgba(14, 165, 233, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.step-body em {
  color: #d32f2f;
  font-size: 0.9rem;
}

.text-danger {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.note-danger {
  color: #ef4444;
  padding: 0;
  background-color: transparent;
}

.text-success {
  color: #16a34a;
  background-color: rgba(22, 163, 74, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.text-warning {
  color: #d97706;
  background-color: rgba(217, 119, 6, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
