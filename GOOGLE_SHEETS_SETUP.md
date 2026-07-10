# Google Sheets Coach Sync Setup

Google Sheets coach sync is optional. Life-Fit Running Coach keeps working normally without a coach report link, and week closeout is never blocked if a report cannot be sent.

## 1. Create a Google Sheet

Create a new Google Sheet for coach reports. Add two tabs named:

- `Week Summaries`
- `Workouts`

You can add headers now, or let the script append rows beneath any headers you add later.

## 2. Open Apps Script

In your Google Sheet, choose **Extensions → Apps Script**.

## 3. Add the webhook script

Replace the starter code with this placeholder script:

```javascript
function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var payload = JSON.parse(e.postData.contents || '{}');

  if (payload.type === 'test') {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var weekSheet = ss.getSheetByName('Week Summaries') || ss.insertSheet('Week Summaries');
  var workoutSheet = ss.getSheetByName('Workouts') || ss.insertSheet('Workouts');
  var summary = payload.weekSummary || {};
  var athlete = payload.athlete || {};

  weekSheet.appendRow([
    payload.sentAt,
    athlete.name,
    athlete.raceDistance,
    athlete.raceDate,
    athlete.goal,
    summary.id,
    summary.weekNumber,
    summary.phase,
    summary.weekType,
    summary.weekStart,
    summary.weekEnd,
    summary.foundationPlanned,
    summary.foundationCompleted,
    summary.optionalPlanned,
    summary.optionalCompleted,
    summary.extraCompleted,
    summary.targetKmMin,
    summary.targetKmMax,
    summary.actualKm,
    summary.targetMinutesMin,
    summary.targetMinutesMax,
    summary.actualMinutes,
    summary.weeklyNote,
    summary.missedReason,
    summary.closedAt
  ]);

  (payload.workouts || []).forEach(function(workout) {
    workoutSheet.appendRow([
      payload.sentAt,
      athlete.name,
      summary.weekNumber,
      workout.workoutId,
      workout.workoutTitle,
      workout.category,
      workout.type,
      workout.plannedDay,
      workout.status,
      workout.plannedDistanceKm,
      workout.actualDistanceKm,
      workout.plannedDurationMin,
      workout.actualDurationMin,
      workout.feeling,
      workout.notes,
      workout.completedAt
    ]);
  });

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 4. Deploy as a Web App

In Apps Script, choose **Deploy → New deployment**.

Use these settings:

- Type: **Web app**
- Execute as: **Me**
- Who has access: choose the option that allows the app to post to the script

Confirm the deployment and copy the Web App URL.

## 5. Copy the URL into Life-Fit Running Coach

Open the app and go to **Settings → Coach Sync**.

Paste the Web App URL into **Coach report link**, then choose **Save**.

## 6. Test Connection

Choose **Test Connection** in Settings.

If it succeeds, future week closeouts will send the week summary and workout rows to the sheet. If a send fails later, the week is still saved on the device and the report is kept as a pending coach report that can be retried from Settings.
