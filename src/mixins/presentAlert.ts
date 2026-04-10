import { alertController } from "@ionic/vue";

const presentAlert = async (h: string, sub: string, m: string, cssClass: string = '') => {
  const alert = await alertController.create({ header: h, subHeader: sub, message: m, buttons: ['OK'], cssClass: cssClass });
  await alert.present();
};

export default {
  presentAlert
}