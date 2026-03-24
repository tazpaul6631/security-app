<template>
    <ion-page>
        <ion-header>
            <ion-toolbar class="none-padding">
                <ion-buttons slot="start">
                    <ion-back-button default-href="/home"></ion-back-button>
                </ion-buttons>
                <ion-title>{{ $t('page.tutorial') }}</ion-title>
            </ion-toolbar>
        </ion-header>

        <ion-content class="ion-padding content-bg">
            <div class="tutorial-intro">
                <h2>Cẩm nang Tuần tra</h2>
            </div>

            <ion-accordion-group>

                <ion-accordion value="start">
                    <ion-item slot="header" color="secondary">
                        <ion-label class="accordion-title">1. Bắt đầu ca trực</ion-label>
                    </ion-item>
                    <div class="ion-padding accordion-content-bg" slot="content">
                        <ion-card class="step-card">
                            <img src="/src/assets/images/tutorial/0.png" alt="login" />
                            <ion-card-header>
                                <ion-card-title class="step-title">Bước 1: Đăng nhập</ion-card-title>
                            </ion-card-header>
                            <ion-card-content>
                                Nhập mã nhân viên và mật khẩu. Bấm <strong>ĐĂNG NHẬP</strong>.
                            </ion-card-content>
                        </ion-card>
                    </div>
                </ion-accordion>

                <ion-accordion value="scan">
                    <ion-item slot="header" color="secondary">
                        <ion-label class="accordion-title">2. Quét điểm tuần tra</ion-label>
                    </ion-item>
                    <div class="ion-padding accordion-content-bg" slot="content">

                        <ion-card class="step-card">
                            <img src="/src/assets/images/tutorial/11.png" alt="Lộ trình" />
                            <ion-card-header>
                                <ion-card-title class="step-title">Bước 1: Điểm tuần tra theo ca</ion-card-title>
                            </ion-card-header>
                            <ion-card-content>
                                Màn hình hiển thị danh sách các điểm cần tuần tra (Ví dụ: Kho thành phẩm, BU2 R&D...).
                            </ion-card-content>
                        </ion-card>

                        <ion-card class="step-card">
                            <img src="/src/assets/images/tutorial/12.png" alt="Quét mã" />
                            <ion-card-header>
                                <ion-card-title class="step-title">Bước 2: Bật máy quét</ion-card-title>
                            </ion-card-header>
                            <ion-card-content>
                                Tại màn hình Lộ trình, bấm nút <strong>SCAN</strong> màu xanh ở góc dưới màn hình.
                            </ion-card-content>
                        </ion-card>

                        <ion-card class="step-card">
                            <img src="/src/assets/images/tutorial/13.png" alt="Lưu ý phím cứng" />
                            <ion-card-header>
                                <ion-card-title class="step-title">Bước 3: Quét mã QR</ion-card-title>
                            </ion-card-header>
                            <ion-card-content>
                                Nếu scan sai sẽ hiện thông báo có <strong class="text-danger"> Vị trí tô đỏ </strong>
                                tìm đúng vị trí scan lại.
                            </ion-card-content>
                        </ion-card>

                    </div>
                </ion-accordion>

                <ion-accordion value="report">
                    <ion-item slot="header" color="secondary">
                        <ion-label class="accordion-title">3. Ghi nhận & Báo cáo sự cố</ion-label>
                    </ion-item>

                    <div class="ion-padding accordion-content-bg" slot="content">

                        <ion-card class="step-card">
                            <img src="/src/assets/images/tutorial/14.png" alt="Phát hiện lỗi có/không" />
                            <ion-card-header>
                                <ion-card-title class="step-title">Bước 1: Nơi report area</ion-card-title>
                            </ion-card-header>
                            <ion-card-content>
                                Thẻ đầu tiên là thông tin khu vực: (thời gian tổng ca đếm ngược <strong
                                    class="text-success">màu xanh</strong> và 10p cuối
                                chuyển màu
                                <strong class="text-danger">màu đỏ</strong>, tên khu vực, ca + mã trực...). Hãy
                                <strong>đánh dấu (✓)</strong> vào ô vuông hoàn thành các vấn đề xong thì gửi báo cáo.
                            </ion-card-content>
                        </ion-card>

                        <ion-card class="step-card">
                            <img src="/src/assets/images/tutorial/15.png" alt="Chọn tình trạng" />
                            <ion-card-header>
                                <ion-card-title class="step-title">Bước 2: Nếu chọn không lỗi</ion-card-title>
                            </ion-card-header>
                            <ion-card-content>
                                Sẽ có nút chụp hình, thêm nhiều hình và thêm ghi chú nếu có thêm sẽ hiện như hình
                            </ion-card-content>
                        </ion-card>

                        <ion-card class="step-card">
                            <img src="/src/assets/images/tutorial/16.png" alt="Chọn tình trạng" />
                            <ion-card-header>
                                <ion-card-title class="step-title">Bước 3: Nếu chọn có lỗi</ion-card-title>
                            </ion-card-header>
                            <ion-card-content>
                                Bấm vào nút <strong>CHỌN TÌNH TRẠNG</strong> vừa xuất hiện sẽ hiện nơi chọn loại sự cố.
                            </ion-card-content>
                        </ion-card>

                        <ion-card class="step-card">
                            <img src="/src/assets/images/tutorial/18.png" alt="Phân loại" />
                            <ion-card-header>
                                <ion-card-title class="step-title">Bước 4: Chọn nhóm sự cố</ion-card-title>
                            </ion-card-header>
                            <ion-card-content>
                                Chọn nhóm danh mục lỗi tương ứng (Ví dụ: Nhấn mũi tên xuống ở mục <strong>Nước</strong>
                                ➔ Chọn <strong>Van</strong>).
                            </ion-card-content>
                        </ion-card>

                        <ion-card class="step-card">
                            <img src="/src/assets/images/tutorial/19.png" alt="Chi tiết lỗi" />
                            <ion-card-header>
                                <ion-card-title class="step-title">Bước 5: Tích chọn lỗi thực tế</ion-card-title>
                            </ion-card-header>
                            <ion-card-content>
                                Đánh dấu vào tình trạng bạn đang thấy (VD: <em>Không khóa, rò rỉ...</em>) hoặc nhập ghi
                                chú thêm. Sau đó bấm <strong>XÁC NHẬN</strong>.
                            </ion-card-content>
                        </ion-card>

                        <ion-card class="step-card">
                            <img src="/src/assets/images/tutorial/10.png" alt="Chụp ảnh hiện trường" />
                            <ion-card-header>
                                <ion-card-title class="step-title">Bước 6: Chụp ảnh bằng chứng</ion-card-title>
                            </ion-card-header>
                            <ion-card-content>
                                App sẽ yêu cầu chụp hình. Hãy hướng camera chụp rõ khu vực xảy ra sự cố (ổ khóa, vũng
                                nước...).<br />
                                Cuối cùng bấm <strong>GỬI BÁO CÁO</strong> để hoàn tất.
                            </ion-card-content>
                        </ion-card>

                    </div>
                </ion-accordion>

                <ion-accordion value="end">
                    <ion-item slot="header" color="secondary">
                        <ion-label class="accordion-title">4. Kết thúc & Đồng bộ dữ liệu</ion-label>
                    </ion-item>
                    <div class="ion-padding accordion-content-bg" slot="content">
                        <ion-card class="step-card">
                            <img src="/src/assets/images/tutorial/44.png" alt="Hoàn thành" />
                            <ion-card-header>
                                <ion-card-title class="step-title">Hoàn thành ca tuần tra</ion-card-title>
                            </ion-card-header>
                            <ion-card-content>
                                Nếu offline thông tin sẽ được lưu lại chờ bạn online lại sẽ tự động gửi dữ liệu đi.
                                <strong class="text-warning">Lưu ý:</strong>
                                <br>
                                <strong class="note-danger">*</strong> Chỉ khi nào online lại dữ liệu sẽ tự động được
                                gửi đi hết mới có thể logout.
                                <br>
                                <strong class="note-danger">*</strong> Sau khi hoàn thành ca hiện tại sẽ thấy ca đó đã
                                hoàn thành, nếu làm ca hiện tại bị lố
                                qua ca sau thì sẽ thấy ca tiếp sau khi hoàn thành.
                                <br>
                                <strong class="note-danger">*</strong> Không được tắt app để tránh mất dữ liệu!
                            </ion-card-content>
                        </ion-card>
                    </div>
                </ion-accordion>

            </ion-accordion-group>
        </ion-content>
    </ion-page>
</template>

<script setup lang="ts">
import {
    IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
    IonContent, IonAccordion, IonAccordionGroup, IonItem, IonLabel,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent
} from '@ionic/vue';
</script>

<style scoped>
/* Màu nền tổng thể */
.content-bg {
    --background: #f8f9fa;
}

/* Định dạng phần giới thiệu */
.tutorial-intro {
    text-align: center;
    margin-bottom: 25px;
    padding-top: 10px;
}

.tutorial-intro h2 {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--ion-color-primary);
    margin-bottom: 8px;
    text-transform: uppercase;
}

.tutorial-intro p {
    font-size: 0.95rem;
    color: #666;
    margin: 0;
}

/* Header của từng mục Accordion */
.accordion-title {
    font-weight: bold;
    font-size: 1.1rem;
    color: #ffffff;
    /* Chữ trắng trên nền primary */
}

/* Định dạng nền bên trong Accordion */
.accordion-content-bg {
    background-color: #eef2f5;
    padding-top: 20px;
}

/* Định dạng thẻ Card chứa từng bước */
.step-card {
    margin: 0 0 25px 0;
    border-radius: 16px;
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
    background: #ffffff;
    overflow: hidden;
    /* Cắt bo tròn các góc của hình ảnh */
}

/* Hình ảnh trong Card */
.step-card img {
    width: 100%;
    max-height: 450px;
    object-fit: contain;
    background-color: #2c2c2c;
    /* Nền tối giúp tôn hình ảnh app lên */
    display: block;
    border-bottom: 3px solid var(--ion-color-primary);
    /* Đường viền nổi bật */
}

/* Khung placeholder khi chưa có ảnh */
.img-placeholder {
    width: 100%;
    height: 200px;
    background-color: #ddd;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
    font-style: italic;
    border-bottom: 3px solid var(--ion-color-medium);
}

.step-title {
    font-size: 1.15rem;
    font-weight: 800;
    color: #222;
}

ion-card-content {
    font-size: 1rem;
    line-height: 1.6;
    color: #444;
    padding-bottom: 20px;
}

/* Đổi màu chữ in đậm để nhấn mạnh thao tác */
ion-card-content strong {
    color: var(--ion-color-primary);
    background-color: rgba(var(--ion-color-primary-rgb), 0.1);
    padding: 2px 6px;
    border-radius: 4px;
}

ion-card-content em {
    color: #d32f2f;
    font-size: 0.9rem;
}

.text-danger {
    color: var(--ion-color-danger);
    background-color: rgba(var(--ion-color-danger-rgb), 0.1);
    padding: 2px 6px;
    border-radius: 4px;
}

.note-danger {
    color: var(--ion-color-danger);
    padding: 0;
    background-color: rgb(0 84 233 / 0%);
}

.text-success {
    color: var(--ion-color-success);
    background-color: rgba(var(--ion-color-success-rgb), 0.1);
    padding: 2px 6px;
    border-radius: 4px;
}

.text-warning {
    color: var(--ion-color-warning);
    background-color: rgba(var(--ion-color-warning-rgb), 0.1);
    padding: 2px 6px;
    border-radius: 4px;
}
</style>