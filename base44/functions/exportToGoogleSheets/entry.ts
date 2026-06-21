import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CONNECTOR_ID = '6a3804f81c2495bbfdf2eae7';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { month, year, incomeData, expenseData, checkOnly } = body;

    // Get the current app user's Google Sheets token
    const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection(CONNECTOR_ID);

    if (checkOnly) {
      return Response.json({ connected: true });
    }

    // Build spreadsheet title
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    const title = `BNG Finance Report - ${monthName} ${year}`;

    // Create a new spreadsheet
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title },
        sheets: [
          { properties: { title: 'Income & Allocation' } },
          { properties: { title: 'Expenses' } },
          { properties: { title: 'Summary' } },
        ],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      return Response.json({ error: err.error?.message || 'Failed to create spreadsheet' }, { status: 500 });
    }

    const spreadsheet = await createRes.json();
    const spreadsheetId = spreadsheet.spreadsheetId;

    // Build Income & Allocation sheet data
    const incomeRows = [
      ['Month', 'Year', 'Total Income (₹)', 'Home Needs (50%)', 'Emergency Fund (15%)', 'Investment (10%)', 'Learning (10%)', 'Luxury (10%)', 'Charity (5%)'],
    ];
    if (incomeData) {
      incomeRows.push([
        monthName, year,
        incomeData.income || 0,
        incomeData.home_needs || 0,
        incomeData.emergency_fund || 0,
        incomeData.investment || 0,
        incomeData.learning || 0,
        incomeData.luxury || 0,
        incomeData.charity || 0,
      ]);
    }

    // Build Expenses sheet data
    const expenseRows = [
      ['Date', 'Category', 'Amount (₹)', 'Notes'],
      ...(expenseData || []).map(e => [e.date, e.category, e.amount, e.notes || '']),
    ];

    // Build Summary sheet data
    const categories = ['home_needs', 'emergency_fund', 'investment', 'learning', 'luxury', 'charity'];
    const categoryLabels = {
      home_needs: 'Home Needs',
      emergency_fund: 'Emergency Fund',
      investment: 'Investment',
      learning: 'Learning',
      luxury: 'Luxury',
      charity: 'Charity',
    };
    const allocations = {
      home_needs: 0.50,
      emergency_fund: 0.15,
      investment: 0.10,
      learning: 0.10,
      luxury: 0.10,
      charity: 0.05,
    };

    const totalIncome = incomeData?.income || 0;
    const summaryRows = [
      ['Category', 'Allocated (₹)', 'Spent (₹)', 'Remaining (₹)', 'Usage %'],
    ];
    categories.forEach(cat => {
      const allocated = totalIncome * allocations[cat];
      const spent = (expenseData || []).filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0);
      const remaining = allocated - spent;
      const usagePct = allocated > 0 ? ((spent / allocated) * 100).toFixed(1) + '%' : '0%';
      summaryRows.push([categoryLabels[cat], allocated, spent, remaining, usagePct]);
    });
    summaryRows.push(['', '', '', '', '']);
    summaryRows.push(['Total Income', totalIncome, '', '', '']);
    summaryRows.push(['Total Expenses', '', (expenseData || []).reduce((s, e) => s + e.amount, 0), '', '']);

    // Write all sheets
    const sheets = spreadsheet.sheets;
    const incomeSheetId = sheets[0].properties.sheetId;
    const expenseSheetId = sheets[1].properties.sheetId;
    const summarySheetId = sheets[2].properties.sheetId;

    const batchUpdateBody = {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: 'Income & Allocation!A1', values: incomeRows },
        { range: 'Expenses!A1', values: expenseRows },
        { range: 'Summary!A1', values: summaryRows },
      ],
    };

    const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batchUpdateBody),
    });

    if (!writeRes.ok) {
      const err = await writeRes.json();
      return Response.json({ error: err.error?.message || 'Failed to write data' }, { status: 500 });
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    return Response.json({
      success: true,
      spreadsheetId,
      spreadsheetUrl,
      title,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});