const { createClient } = require("@supabase/supabase-js");

// Your Supabase credentials
const supabase = createClient(
    "https://tgdahcqseukfivaziawp.supabase.co", 
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZGFoY3FzZXVrZml2YXppYXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxOTIxNzYsImV4cCI6MjEwMTc2ODE3Nn0.H3ptyXobZxbcAuj2vUU6DCVPpjgSTFZBoJ88FUft6Ag"
);

/**
 * Fetches all logs from the 'logs' table by paginating through the results.
 * This is necessary because Supabase limits queries to 1000 rows by default.
 * @returns {Promise<Array>} A promise that resolves to an array of all log objects.
 */
async function fetchAllLogs() {
    const allLogs = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('logs')
            .select('tag, emailId, time')
            .order('time', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error("Error fetching logs:", error);
            hasMore = false; 
            return [];
        }

        if (data && data.length > 0) {
            allLogs.push(...data);
            page++;
            if (data.length < pageSize) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }
    return allLogs;
}


module.exports = async (req, res) => {
    // 1. Fetch ALL logs from the database
    const logs = await fetchAllLogs();

    if (!logs) {
        return res.status(500).send("Failed to load logs");
    }

    // 2. Define your campaigns with a new 'baseOpens' property
    const campaignConfig = {
        july: {
            displayName: "July Two Year",
            totalSent: 1500,
            baseOpens: 1 // <-- Add your default number here
        },
       
    };

    // --- DATA PROCESSING ---

    const summaryStats = {};
    const uniqueLogsByTag = {};

    for (const tag in campaignConfig) {
        const config = campaignConfig[tag];
        
        const tagLogs = logs.filter(log => log.tag === tag && log.emailId);
        
        const uniqueEmails = new Map();
        for (const log of tagLogs) {
            if (!uniqueEmails.has(log.emailId)) {
                uniqueEmails.set(log.emailId, log.time);
            }
        }

        // Get the count from the database
        const dbUniqueOpenCount = uniqueEmails.size;
        
        // Get the base count from config, defaulting to 0 if not set
        const baseOpenCount = config.baseOpens || 0;

        // Calculate the total count by adding the base count
        const totalUniqueOpenCount = dbUniqueOpenCount + baseOpenCount;
        
        // Calculate the open rate using the new total count
        const openRate = config.totalSent > 0 ? (totalUniqueOpenCount / config.totalSent) * 100 : 0;
        
        // Update the summary to display the new total count
        summaryStats[tag] = `
            <li>
                <strong>${config.displayName}:</strong> 
                ${totalUniqueOpenCount} opens from inbox out of ${config.totalSent} sent (${openRate.toFixed(2)}%)
            </li>`;
            
        // The detailed list still only shows actual emails from the database
        uniqueLogsByTag[tag] = Array.from(uniqueEmails, ([emailId, time]) => ({ emailId, time }));
    }


    // 4. Generate the final HTML
    const html = `
    <html>
    <head>
        <title>Email Campaign Report</title>
        <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h2, h3 { color: #005a9c; }
            ul { list-style-type: none; padding-left: 0; }
            li { background: #eaf6ff; margin-bottom: 8px; padding: 10px; border-left: 4px solid #005a9c; }
            select { font-size: 16px; padding: 8px; margin-top: 10px; }
            #email-list-container { margin-top: 20px; }
            table { border-collapse: collapse; width: 100%; max-width: 700px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            th { background: #f2f2f2; }
            #email-table { display: none; }
        </style>
    </head>
    <body>
        <h2>📬 Email Campaign Summary</h2>
        <ul>
            ${Object.values(summaryStats).join("")}
        </ul>

        <hr>

        <h3>📜 View Unique Opens by Campaign</h3>
        <select id="campaign-selector" onchange="showEmails(this.value)">
            <option value="">-- Select a Campaign --</option>
            ${Object.entries(campaignConfig).map(([tag, config]) => `
                <option value="${tag}">${config.displayName}</option>
            `).join("")}
        </select>

        <div id="email-list-container">
            <table id="email-table">
                <thead>
                    <tr><th>Email ID</th><th>Last Opened At</th></tr>
                </thead>
                <tbody id="email-table-body">
                </tbody>
            </table>
        </div>

        <script>
            // This data remains unchanged, it only contains actual opens from logs
            const emailDataByTag = ${JSON.stringify(uniqueLogsByTag)};

            function showEmails(tag) {
                const table = document.getElementById('email-table');
                const tableBody = document.getElementById('email-table-body');
                
                tableBody.innerHTML = '';

                if (!tag || !emailDataByTag[tag]) {
                    table.style.display = 'none';
                    return;
                }

                const emails = emailDataByTag[tag];
                
                if (emails.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="2">No unique opens recorded for this campaign.</td></tr>';
                } else {
                    emails.forEach(log => {
                        const row = tableBody.insertRow();
                        const cell1 = row.insertCell(0);
                        const cell2 = row.insertCell(1);
                        
                        cell1.textContent = log.emailId;
                        cell2.textContent = new Date(log.time).toLocaleString();
                    });
                }
                table.style.display = 'table';
            }
        </script>
    </body>
    </html>
    `;

    res.setHeader("Content-Type", "text/html");
    res.send(html);
};
