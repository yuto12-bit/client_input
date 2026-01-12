function doPost(e) {
  // CORS用ヘッダー作成（no-corsでは無視されるが、念のため）
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*" 
  };

  try {
    if (!e || !e.postData) {
      return ContentService.createTextOutput(JSON.stringify({result: 'error', error: 'No Data'}))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    const timestamp = new Date();
    
    const row = [
      timestamp,
      data.companyName,
      data.zipCode + ' ' + data.address,
      data.phone,
      data.email,
      data.jobType + (data.jobTypeOther ? '(' + data.jobTypeOther + ')' : ''),
      data.employmentStatus,
      Array.isArray(data.qualification) ? data.qualification.join(', ') : data.qualification,
      data.salaryType + ' ' + data.salaryMin + ' ~ ' + data.salaryMax,
      data.workTimeStart + ' ~ ' + data.workTimeEnd + ' (休憩:' + data.breakTime + '分)',
      data.holiday + (data.holidayNote ? '(' + data.holidayNote + ')' : ''),
      Array.isArray(data.insurance) ? data.insurance.join(', ') : data.insurance,
      data.probation === 'あり' ? ('あり: ' + data.probationPeriod + ' ' + data.probationCondition) : 'なし',
      '面接:' + data.interviewCount + ', 履歴書:' + data.resume + ', 即日:' + (data.hireImmediately || 'なし'),
      data.area
    ];

    sheet.appendRow(row);
    
    // 通知メール（必ずONにする）
    const adminEmail = "{{ADMIN_EMAIL}}"; 
    if (adminEmail && adminEmail !== "{{ADMIN_EMAIL}}") {
      MailApp.sendEmail({
        to: adminEmail,
        subject: "【求人ヒアリング】新規回答",
        body: "会社名: " + data.companyName + "\nスプレッドシートを確認してください。"
      });
    }

    // no-cors用レスポンス
    return ContentService.createTextOutput(JSON.stringify({result: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({result: 'error', error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}