

const { createClient } = require("@supabase/supabase-js");

// ============================================================
// SUPABASE CONFIGURATION
// ============================================================

// Recommended: use environment variables.
//
// SUPABASE_URL=https://tgdahcqseukfivaziawp.supabase.co
// SUPABASE_ANON_KEY=your_supabase_anon_key
//
// IMPORTANT:
// The URL must be the plain URL.
// DO NOT use:
// "[https://...](https://...)"

const SUPABASE_URL =
    process.env.SUPABASE_URL ||
    "https://tgdahcqseukfivaziawp.supabase.co";

const SUPABASE_ANON_KEY =
    process.env.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZGFoY3FzZXVrZml2YXppYXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxOTIxNzYsImV4cCI6MjEwMTc2ODE3Nn0.H3ptyXobZxbcAuj2vUU6DCVPpjgSTFZBoJ88FUft6Ag"
;

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ============================================================
// FETCH ALL LOGS
// ============================================================

async function fetchAllLogs() {
    const allLogs = [];

    const pageSize = 1000;
    let page = 0;

    while (true) {
        try {
            const start = page * pageSize;
            const end = start + pageSize - 1;

            console.log(
                `Fetching logs ${start} - ${end}...`
            );

            const { data, error } = await supabase
                .from("logs")
                .select("tag, emailId, time")
                .order("time", { ascending: false })
                .range(start, end);

            // ------------------------------------------------
            // Supabase returned an error
            // ------------------------------------------------

            if (error) {
                console.error("=================================");
                console.error("SUPABASE ERROR");
                console.error("=================================");
                console.error("Message:", error.message);
                console.error("Details:", error.details);
                console.error("Hint:", error.hint);
                console.error("Code:", error.code);
                console.error("=================================");

                return null;
            }

            // ------------------------------------------------
            // No more records
            // ------------------------------------------------

            if (!data || data.length === 0) {
                break;
            }

            allLogs.push(...data);

            console.log(
                `Received ${data.length} logs`
            );

            // ------------------------------------------------
            // If less than pageSize was returned,
            // this was the final page.
            // ------------------------------------------------

            if (data.length < pageSize) {
                break;
            }

            page++;

        } catch (err) {

            console.error("=================================");
            console.error("SUPABASE FETCH EXCEPTION");
            console.error("=================================");
            console.error("Message:", err.message);
            console.error("Cause:", err.cause);
            console.error("Stack:", err.stack);
            console.error("=================================");

            return null;
        }
    }

    console.log(
        `Finished. Total logs fetched: ${allLogs.length}`
    );

    return allLogs;
}


// ============================================================
// SERVER FUNCTION
// ============================================================

module.exports = async (req, res) => {

    try {

        // ----------------------------------------------------
        // 1. Validate Supabase configuration
        // ----------------------------------------------------

        if (
            !SUPABASE_URL ||
            !SUPABASE_ANON_KEY ||
            SUPABASE_ANON_KEY === "YOUR_SUPABASE_ANON_KEY"
        ) {
            console.error(
                "Supabase credentials are not configured."
            );

            return res
                .status(500)
                .send("Supabase credentials are not configured.");
        }


        // ----------------------------------------------------
        // 2. Fetch all logs
        // ----------------------------------------------------

        const logs = await fetchAllLogs();

        if (logs === null) {
            return res
                .status(500)
                .send(
                    "Failed to load logs from Supabase. Check server logs for details."
                );
        }


        // ----------------------------------------------------
        // 3. Campaign configuration
        // ----------------------------------------------------

        const campaignConfig = {

            july: {
                displayName: "July Two Year",

                // Number of emails sent
                totalSent: 1500,

                // Additional opens that you want to add manually
                baseOpens: 1
            }

        };


        // ----------------------------------------------------
        // 4. Process campaign data
        // ----------------------------------------------------

        const summaryStats = {};
        const uniqueLogsByTag = {};


        for (const tag in campaignConfig) {

            const config = campaignConfig[tag];


            // ------------------------------------------------
            // Get logs belonging to this campaign
            // ------------------------------------------------

            const tagLogs = logs.filter(
                (log) =>
                    log.tag === tag &&
                    log.emailId
            );


            // ------------------------------------------------
            // Create unique email map
            //
            // emailId => latest/first encountered time
            //
            // Because the query is ordered descending by time,
            // the first occurrence is the latest open.
            // ------------------------------------------------

            const uniqueEmails = new Map();


            for (const log of tagLogs) {

                if (!uniqueEmails.has(log.emailId)) {

                    uniqueEmails.set(
                        log.emailId,
                        log.time
                    );

                }

            }


            // ------------------------------------------------
            // Database unique opens
            // ------------------------------------------------

            const dbUniqueOpenCount =
                uniqueEmails.size;


            // ------------------------------------------------
            // Manual/base opens
            // ------------------------------------------------

            const baseOpenCount =
                Number(config.baseOpens) || 0;


            // ------------------------------------------------
            // Total opens
            // ------------------------------------------------

            const totalUniqueOpenCount =
                dbUniqueOpenCount +
                baseOpenCount;


            // ------------------------------------------------
            // Calculate open rate
            // ------------------------------------------------

            const openRate =
                config.totalSent > 0
                    ? (
                        totalUniqueOpenCount /
                        config.totalSent
                    ) * 100
                    : 0;


            // ------------------------------------------------
            // Summary HTML
            // ------------------------------------------------

            summaryStats[tag] = `
                <li>
                    <strong>${escapeHtml(config.displayName)}:</strong>
                    ${totalUniqueOpenCount}
                    opens from inbox out of
                    ${config.totalSent}
                    sent
                    (${openRate.toFixed(2)}%)
                </li>
            `;


            // ------------------------------------------------
            // Detailed unique email list
            // ------------------------------------------------

            uniqueLogsByTag[tag] =
                Array.from(
                    uniqueEmails,
                    ([emailId, time]) => ({
                        emailId,
                        time
                    })
                );

        }


        // ----------------------------------------------------
        // 5. Generate campaign options
        // ----------------------------------------------------

        const campaignOptions =
            Object.entries(campaignConfig)
                .map(
                    ([tag, config]) => `
                        <option value="${escapeHtml(tag)}">
                            ${escapeHtml(config.displayName)}
                        </option>
                    `
                )
                .join("");


        // ----------------------------------------------------
        // 6. Generate final HTML
        // ----------------------------------------------------

        const html = `
<!DOCTYPE html>

<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Email Campaign Report</title>

    <style>

        * {
            box-sizing: border-box;
        }

        body {
            font-family:
                Arial,
                Helvetica,
                sans-serif;

            padding: 20px;

            margin: 0;

            color: #333;

            background: #ffffff;
        }

        .container {
            max-width: 1000px;

            margin: 0 auto;
        }

        h2,
        h3 {
            color: #005a9c;
        }

        h2 {
            margin-bottom: 20px;
        }

        ul {
            list-style-type: none;

            padding-left: 0;
        }

        li {
            background: #eaf6ff;

            margin-bottom: 8px;

            padding: 12px;

            border-left:
                4px solid #005a9c;

            border-radius: 4px;
        }

        select {
            font-size: 16px;

            padding: 10px;

            margin-top: 10px;

            min-width: 250px;

            border:
                1px solid #ccc;

            border-radius: 4px;

            background: white;
        }

        #email-list-container {
            margin-top: 20px;

            overflow-x: auto;
        }

        table {
            border-collapse: collapse;

            width: 100%;

            max-width: 900px;

            background: white;
        }

        th,
        td {
            border:
                1px solid #ccc;

            padding: 10px;

            text-align: left;
        }

        th {
            background: #f2f2f2;

            color: #333;
        }

        tr:nth-child(even) {
            background: #fafafa;
        }

        #email-table {
            display: none;
        }

        .stats {
            margin-top: 20px;

            padding: 15px;

            background: #f8f8f8;

            border-radius: 5px;
        }

        .small-text {
            color: #777;

            font-size: 13px;

            margin-top: 20px;
        }

    </style>

</head>


<body>

<div class="container">

    <h2>
        📬 Email Campaign Summary
    </h2>


    <div class="stats">

        <ul>
            ${Object.values(summaryStats).join("")}
        </ul>

    </div>


    <hr>


    <h3>
        📜 View Unique Opens by Campaign
    </h3>


    <select
        id="campaign-selector"
        onchange="showEmails(this.value)"
    >

        <option value="">
            -- Select a Campaign --
        </option>

        ${campaignOptions}

    </select>


    <div id="email-list-container">

        <table id="email-table">

            <thead>

                <tr>
                    <th>Email ID</th>
                    <th>Last Opened At</th>
                </tr>

            </thead>

            <tbody id="email-table-body">
            </tbody>

        </table>

    </div>


    <p class="small-text">
        Database records are counted uniquely by Email ID.
    </p>


</div>


<script>

    // --------------------------------------------------------
    // Unique email data generated on the server
    // --------------------------------------------------------

    const emailDataByTag =
        ${JSON.stringify(uniqueLogsByTag)};


    // --------------------------------------------------------
    // Display emails for selected campaign
    // --------------------------------------------------------

    function showEmails(tag) {

        const table =
            document.getElementById(
                "email-table"
            );

        const tableBody =
            document.getElementById(
                "email-table-body"
            );


        tableBody.innerHTML = "";


        // No campaign selected

        if (
            !tag ||
            !emailDataByTag[tag]
        ) {

            table.style.display = "none";

            return;
        }


        const emails =
            emailDataByTag[tag];


        // No emails

        if (emails.length === 0) {

            tableBody.innerHTML = \`
                <tr>
                    <td colspan="2">
                        No unique opens recorded
                        for this campaign.
                    </td>
                </tr>
            \`;

        }

        else {

            emails.forEach(function(log) {

                const row =
                    tableBody.insertRow();


                const cell1 =
                    row.insertCell(0);

                const cell2 =
                    row.insertCell(1);


                cell1.textContent =
                    log.emailId;


                cell2.textContent =
                    log.time
                        ? new Date(
                            log.time
                        ).toLocaleString()
                        : "Unknown";

            });

        }


        table.style.display = "table";

    }

</script>


</body>

</html>
`;


        // ----------------------------------------------------
        // 7. Send HTML response
        // ----------------------------------------------------

        res.setHeader(
            "Content-Type",
            "text/html; charset=utf-8"
        );

        return res.send(html);


    } catch (error) {

        // ----------------------------------------------------
        // Global error handler
        // ----------------------------------------------------

        console.error(
            "================================="
        );

        console.error(
            "SERVER ERROR"
        );

        console.error(
            "================================="
        );

        console.error(
            "Message:",
            error.message
        );

        console.error(
            "Cause:",
            error.cause
        );

        console.error(
            "Stack:",
            error.stack
        );

        console.error(
            "================================="
        );


        return res
            .status(500)
            .send(
                "Internal server error. Check server logs."
            );

    }

};


// ============================================================
// HTML ESCAPE HELPER
// ============================================================

function escapeHtml(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

