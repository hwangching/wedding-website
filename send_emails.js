const fs = require('fs');
const csv = require('csv-parser');
const nodemailer = require('nodemailer');

// ================= 設定區塊 =================
// 您的信箱與應用程式密碼
// 注意：如果是 Gmail，密碼*不能*用你登入的密碼，必須去 Google 帳號設定申請「應用程式密碼」
const EMAIL_ACCOUNT = 'your_email@gmail.com'; 
const EMAIL_PASSWORD = 'your_app_password';

// 讀取的 CSV 檔案名稱 (請先從 Google Sheet 下載為 guests.csv 並放在同一個資料夾)
const CSV_FILE = 'guests.csv';
// ==========================================

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_ACCOUNT,
    pass: EMAIL_PASSWORD
  }
});

const results = [];

fs.createReadStream(CSV_FILE)
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', async () => {
    console.log(`讀取到 ${results.length} 筆資料，準備開始寄信...`);
    
    for (const row of results) {
      // 依照你 Google Sheet 的標題名稱為主
      const { EMAIL, NAME, ADULT, KID } = row;
      
      if (!EMAIL) continue;

      const mailOptions = {
        from: EMAIL_ACCOUNT,
        to: EMAIL,
        cc: 'jimhwch@gmail.com, hsin0717bean@gmail.com',
        subject: `【婚禮出席確認】${NAME}，麻煩您協助填寫進一步的出席調查！`,
        text: `親愛的 ${NAME} 您好：

非常感謝您之前填寫我們的婚禮意願表單！隨著婚禮即將到來，我們需要進一步向您確認當天的一些細節，以確保能為您提供最好的安排。

麻煩您直接回信，幫我們回覆以下幾個問題：
1. 出席人數確認 (您先前填寫：大人 ${ADULT || 0} 位 / 小孩 ${KID || 0} 位)
   請問人數是否有異動？回覆：
2. 是否會參加證婚儀式 (10:30開始)
   回覆：
3. 素食人數 (請填寫人名，或留空白。例如：AAA, BBB)
   回覆：
4. 攜伴者名稱 (座位牌使用，若超過一位者用 , 區分)
   回覆：
5. 兒童椅人數: 
   回覆：
6. 是否會有接駁車需求 (預先統計人數，若確定提供會另行通知)
   回覆：
7. 是否開車前往 (是的話請提供車牌號碼，申請仰德大道通行證用)
   回覆：

期待在婚禮上與您相見！

[您的名字/新人署名] 敬上
`
      };

      try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ 成功寄信給: ${NAME} (${EMAIL})`);
      } catch (error) {
        console.error(`❌ 寄信失敗: ${NAME} (${EMAIL})`, error);
      }
      
      // 避免寄信過快被 Google 擋下來，每寄一封停頓 1.5 秒
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    console.log('🎉 全部信件寄送完成！');
  });
