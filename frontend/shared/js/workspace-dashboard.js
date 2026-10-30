/**
 * ProcureIQ - Workspace Dashboard Controller
 * Handles user-specific (procurement) and company-wide (admin) workspace activity views.
 */

window.WorkspaceDashboard = (function () {
    let currentData = null;
    let currentPrFilterStatus = "ALL";
    let lastOriginTab = null;
    let isInitialized = false;

    function formatCurrency(val) {
        return "₹ " + Number(val || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    function formatDate(val) {
        if (!val) return "-";
        const d = new Date(val);
        if (isNaN(d.getTime())) return String(val).split("T")[0];
        return d.toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
            day: "2-digit"
        });
    }

    function escapeHtml(str) {
        if (str === null || str === undefined) return "-";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function statusBadge(status) {
        const s = String(status || "OPEN").toUpperCase();
        let cls = "open";
        let label = "Open";
        if (s === "VENDOR_SELECTED") {
            cls = "vendor-selected";
            label = "Vendor Selected";
        } else if (s === "CLOSED" || s === "COMPLETED") {
            cls = "closed";
            label = "Closed";
        } else if (s === "CANCELLED") {
            cls = "cancelled";
            label = "Cancelled";
        }
        return `<span class="status-badge ${cls}">${label}</span>`;
    }

    async function loadDashboard(userId = null) {
        const refreshBtn = document.getElementById("wdRefreshBtn");
        if (refreshBtn) refreshBtn.classList.add("loading");

        try {
            let url = "/workspace/dashboard";
            if (userId && userId !== "all") {
                url += `?user_id=${encodeURIComponent(userId)}`;
            }

            const response = await apiFetch(url);
            if (!response.ok) {
                throw new Error("Failed to load workspace dashboard");
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || "Error loading dashboard");
            }

            currentData = data;
            render(data);

        } catch (err) {
            console.error("Workspace Dashboard error:", err);
            const emptyText = document.getElementById("wdPrEmptyText");
            if (emptyText) emptyText.textContent = "Unable to load workspace data. Please retry.";
        } finally {
            if (refreshBtn) refreshBtn.classList.remove("loading");
        }
    }

    function render(data) {
        const isAdmin = Boolean(data.is_admin);
        const filterUserId = data.filter_user_id;

        // Scope & Titles
        const titleEl = document.getElementById("wdTitle");
        const subtitleEl = document.getElementById("wdSubtitle");
        const teamTabBtn = document.getElementById("wdTeamTabBtn");
        const newPrBtn = document.getElementById("wdNewPrBtn");
        const thPrCreator = document.getElementById("wdThPrCreator");
        const thGrReceiver = document.getElementById("wdThGrReceiver");

        const backToTeamBtn = document.getElementById("wdBackToTeamBtn");
        const resetFilterBtn = document.getElementById("wdResetFilterBtn");

        if (isAdmin) {
            if (titleEl) titleEl.textContent = "Company Workspace Dashboard";

            if (filterUserId) {
                const foundUser = (data.available_users || []).find(u => Number(u.user_id) === Number(filterUserId));
                const uname = foundUser ? foundUser.username : `User #${filterUserId}`;

                if (subtitleEl) subtitleEl.textContent = `Showing purchase requests and goods receipts filtered for ${uname}`;

                if (backToTeamBtn) backToTeamBtn.classList.remove("hidden");
                if (resetFilterBtn) resetFilterBtn.classList.remove("hidden");
            } else {
                if (subtitleEl) subtitleEl.textContent = "Overview of company-wide purchase requests and goods received activity";
                if (backToTeamBtn) backToTeamBtn.classList.add("hidden");
                if (resetFilterBtn) resetFilterBtn.classList.add("hidden");
            }

            if (teamTabBtn) teamTabBtn.classList.remove("hidden");
            if (newPrBtn) newPrBtn.classList.add("hidden");

            if (thPrCreator) thPrCreator.classList.remove("hidden");
            if (thGrReceiver) thGrReceiver.classList.remove("hidden");

        } else {
            const myName = data.current_user?.username || "My Workspace";
            if (titleEl) titleEl.textContent = "Company Workspace Dashboard";
            if (subtitleEl) subtitleEl.textContent = "Overview of company-wide purchase requests and goods received activity";

            if (backToTeamBtn) backToTeamBtn.classList.add("hidden");
            if (resetFilterBtn) resetFilterBtn.classList.add("hidden");

            if (teamTabBtn) teamTabBtn.classList.add("hidden");
            if (newPrBtn) newPrBtn.classList.remove("hidden");

            if (thPrCreator) thPrCreator.classList.remove("hidden");
            if (thGrReceiver) thGrReceiver.classList.remove("hidden");
        }

        // Metrics - 6-Card Procurement Pipeline
        const m = data.metrics || {};
        const setText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        const totalValidPos = (Number(m.draft_pos || 0) + Number(m.issued_pos || 0) + Number(m.completed_pos || 0));

        setText("wdTotalPrs", Number(m.total_prs || 0).toLocaleString("en-IN"));
        setText("wdTotalPos", (m.total_pos !== undefined && Number(m.total_pos) <= totalValidPos ? Number(m.total_pos) : totalValidPos).toLocaleString("en-IN"));
        setText("wdDraftPos", Number(m.draft_pos || 0).toLocaleString("en-IN"));
        setText("wdIssuedPos", Number(m.issued_pos || 0).toLocaleString("en-IN"));
        setText("wdCompletedPos", Number(m.completed_pos || 0).toLocaleString("en-IN"));

        // Fallback elements if present
        if (document.getElementById("wdTotalPrValue")) {
            document.getElementById("wdTotalPrValue").textContent = formatCurrency(m.total_pr_value);
        }
        if (document.getElementById("wdTotalGrn")) {
            document.getElementById("wdTotalGrn").textContent = Number(m.total_grn_receipts || 0).toLocaleString("en-IN");
        }
        if (document.getElementById("wdTotalQty")) {
            document.getElementById("wdTotalQty").textContent = Number(m.total_received_quantity || 0).toLocaleString("en-IN");
        }

        // Tab counts
        const prs = data.purchase_requests || [];
        const grns = data.goods_received || [];
        const teams = data.user_summary || [];

        document.getElementById("wdPrBadge").textContent = prs.length;
        document.getElementById("wdGrBadge").textContent = grns.length;
        if (document.getElementById("wdTeamBadge")) {
            document.getElementById("wdTeamBadge").textContent = teams.length;
        }

        renderPrs(prs, isAdmin);
        renderGrns(grns, isAdmin);
        if (isAdmin) {
            renderTeam(teams);
        }
    }

    function renderPrs(prs, isAdmin) {
        const tbody = document.getElementById("wdPrTableBody");
        const emptyState = document.getElementById("wdPrEmptyState");
        const table = tbody.closest("table");
        const searchVal = (document.getElementById("wdPrSearch")?.value || "").toLowerCase().trim();

        const filtered = prs.filter(pr => {
            if (currentPrFilterStatus !== "ALL" && String(pr.status).toUpperCase() !== currentPrFilterStatus) {
                return false;
            }
            if (searchVal) {
                const combined = [
                    pr.pr_number,
                    pr.party_name,
                    pr.item_name,
                    pr.make,
                    pr.model,
                    pr.creator_username
                ].filter(Boolean).join(" ").toLowerCase();
                return combined.includes(searchVal);
            }
            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = "";
            if (table) {
                table.classList.add("hidden");
                table.style.display = "none";
            }
            if (emptyState) {
                emptyState.classList.remove("hidden");
                emptyState.style.display = "flex";
            }
            return;
        }

        if (table) {
            table.classList.remove("hidden");
            table.style.display = "";
        }
        if (emptyState) {
            emptyState.classList.add("hidden");
            emptyState.style.display = "none";
        }

        tbody.innerHTML = filtered.map(pr => {
            const creatorHtml = `
                <td>
                    <span class="user-pill">
                        <span class="user-avatar-tiny">${(pr.creator_username || "U")[0].toUpperCase()}</span>
                        <span>${escapeHtml(pr.creator_username || "Unknown")}</span>
                    </span>
                </td>
            `;

            return `
                <tr>
                    <td><strong>${escapeHtml(pr.pr_number)}</strong></td>
                    ${creatorHtml}
                    <td>${formatDate(pr.pr_date)}</td>
                    <td>${escapeHtml(pr.party_name)}</td>
                    <td>
                        <div style="font-weight: 600; color: #0f172a;">${escapeHtml(pr.item_name)}</div>
                        <div style="font-size: 12.5px; color: #64748b; margin-top: 2px;">${escapeHtml(pr.make || "-")} / ${escapeHtml(pr.model || "-")}</div>
                    </td>
                    <td>${escapeHtml(pr.qty)} ${escapeHtml(pr.unit || "")}</td>
                    <td style="text-align: right; font-weight: 700; color: #0f172a;">${formatCurrency(pr.taxable_value)}</td>
                    <td>${statusBadge(pr.status)}</td>
                </tr>
            `;
        }).join("");
    }

    function renderGrns(grns, isAdmin) {
        const tbody = document.getElementById("wdGrTableBody");
        const emptyState = document.getElementById("wdGrEmptyState");
        const table = tbody.closest("table");
        const searchVal = (document.getElementById("wdGrSearch")?.value || "").toLowerCase().trim();

        const filtered = grns.filter(gr => {
            if (searchVal) {
                const combined = [
                    String(gr.receipt_id),
                    gr.po_number,
                    gr.vendor_name,
                    gr.item_name,
                    gr.receiver_username,
                    gr.remarks
                ].filter(Boolean).join(" ").toLowerCase();
                return combined.includes(searchVal);
            }
            return true;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = "";
            if (table) {
                table.classList.add("hidden");
                table.style.display = "none";
            }
            if (emptyState) {
                emptyState.classList.remove("hidden");
                emptyState.style.display = "flex";
            }
            return;
        }

        if (table) {
            table.classList.remove("hidden");
            table.style.display = "";
        }
        if (emptyState) {
            emptyState.classList.add("hidden");
            emptyState.style.display = "none";
        }

        tbody.innerHTML = filtered.map(gr => {
            const receiverHtml = isAdmin ? `
                <td>
                    <span class="user-pill">
                        <span class="user-avatar-tiny">${(gr.receiver_username || "U")[0].toUpperCase()}</span>
                        <span>${escapeHtml(gr.receiver_username || "Unknown")}</span>
                    </span>
                </td>
            ` : "";

            const defQty = Number(gr.defective_quantity || 0);
            const defHtml = defQty > 0
                ? `<span style="color: #dc2626; font-weight: 700;">${defQty}</span>`
                : `<span style="color: #94a3b8;">-</span>`;

            return `
                <tr>
                    <td><strong>#${gr.receipt_id}</strong></td>
                    ${receiverHtml}
                    <td>${formatDate(gr.received_date)}</td>
                    <td><span style="font-weight: 600; color: #0B57A4;">${escapeHtml(gr.po_number)}</span></td>
                    <td>${escapeHtml(gr.vendor_name)}</td>
                    <td>
                        <div style="font-weight: 600; color: #0f172a;">${escapeHtml(gr.item_name)}</div>
                        <div style="font-size: 12.5px; color: #64748b; margin-top: 2px;">${escapeHtml(gr.make || "-")} / ${escapeHtml(gr.model || "-")}</div>
                    </td>
                    <td><strong style="color: #059669;">+${escapeHtml(gr.received_quantity)}</strong> ${escapeHtml(gr.unit || "")}</td>
                    <td style="text-align: center;">${defHtml}</td>
                    <td style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #64748b;">
                        ${escapeHtml(gr.remarks || "-")}
                    </td>
                </tr>
            `;
        }).join("");
    }

    function renderTeam(team) {
        const tbody = document.getElementById("wdTeamTableBody");
        if (!tbody) return;

        if (!team || team.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 30px; color: #64748b;">No active procurement users found.</td></tr>`;
            return;
        }

        tbody.innerHTML = team.map(u => {
            const roleName = String(u.role).replace(/_/g, " ");
            return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="user-avatar-tiny" style="width: 24px; height: 24px; font-size: 11px;">
                                ${(u.username || "U")[0].toUpperCase()}
                            </span>
                            <span style="font-weight: 700; color: #0f172a;">${escapeHtml(u.username)}</span>
                        </div>
                    </td>
                    <td><span style="font-size: 13px; font-weight: 600; color: #64748b;">${escapeHtml(roleName)}</span></td>
                    <td style="text-align: center; font-weight: 700;">${Number(u.pr_count).toLocaleString("en-IN")}</td>
                    <td style="text-align: right; font-weight: 700; color: #0f172a;">${formatCurrency(u.total_pr_value)}</td>
                    <td style="text-align: center; font-weight: 700;">${Number(u.gr_count).toLocaleString("en-IN")}</td>
                    <td style="text-align: center; font-weight: 700; color: #059669;">${Number(u.total_received_qty).toLocaleString("en-IN")}</td>
                    <td style="text-align: center;">
                        <button type="button" class="option-button wd-filter-user-btn" data-user-id="${u.user_id}" style="padding: 5px 12px; font-size: 13px;">
                            View Activity
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        tbody.querySelectorAll(".wd-filter-user-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const uid = btn.dataset.userId;
                lastOriginTab = "team";
                const userSelect = document.getElementById("wdUserSelect");
                if (userSelect) userSelect.value = uid;
                loadDashboard(uid);
                // Switch to PRs tab
                switchTab("prs");
            });
        });
    }

    function switchTab(tabId) {
        document.querySelectorAll(".wd-tab-btn").forEach(b => {
            if (b.dataset.wdTab === tabId) b.classList.add("active");
            else b.classList.remove("active");
        });

        document.querySelectorAll(".wd-tab-content").forEach(c => {
            c.classList.remove("active");
        });

        if (tabId === "prs") document.getElementById("wdTabPrs")?.classList.add("active");
        if (tabId === "grn") document.getElementById("wdTabGrn")?.classList.add("active");
        if (tabId === "team") document.getElementById("wdTabTeam")?.classList.add("active");
    }

    function clearFilterAndReturn(targetTab = null) {
        const userSelect = document.getElementById("wdUserSelect");
        if (userSelect) userSelect.value = "all";
        loadDashboard("all");
        if (targetTab) {
            switchTab(targetTab);
            lastOriginTab = null;
        } else if (lastOriginTab) {
            switchTab(lastOriginTab);
            lastOriginTab = null;
        }
    }

    function init(options = {}) {
        if (isInitialized) return;
        isInitialized = true;

        // Back header button (in badge row)
        const backHeaderBtn = document.getElementById("wdBackHeaderBtn");
        if (backHeaderBtn) {
            backHeaderBtn.addEventListener("click", () => {
                clearFilterAndReturn();
            });
        }

        // Back to Team Breakdown button (in filter banner)
        const backToTeamBtn = document.getElementById("wdBackToTeamBtn");
        if (backToTeamBtn) {
            backToTeamBtn.addEventListener("click", () => {
                clearFilterAndReturn("team");
            });
        }

        // Show Full Company Detail button (in filter banner)
        const resetFilterBtn = document.getElementById("wdResetFilterBtn");
        if (resetFilterBtn) {
            resetFilterBtn.addEventListener("click", () => {
                const userSelect = document.getElementById("wdUserSelect");
                if (userSelect) userSelect.value = "all";
                lastOriginTab = null;
                loadDashboard("all");
            });
        }

        // Tab click handlers
        document.querySelectorAll(".wd-tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                switchTab(btn.dataset.wdTab);
            });
        });

        // User dropdown filter (Admin only)
        const userSelect = document.getElementById("wdUserSelect");
        if (userSelect) {
            userSelect.addEventListener("change", () => {
                lastOriginTab = null;
                loadDashboard(userSelect.value);
            });
        }

        // Refresh button
        const refreshBtn = document.getElementById("wdRefreshBtn");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", () => {
                const uid = userSelect ? userSelect.value : null;
                loadDashboard(uid);
            });
        }

        // Shortcut to new PR
        const newPrBtn = document.getElementById("wdNewPrBtn");
        if (newPrBtn && options.onNewPr) {
            newPrBtn.addEventListener("click", () => {
                options.onNewPr();
            });
        }

        // Search inputs
        const prSearch = document.getElementById("wdPrSearch");
        if (prSearch) {
            prSearch.addEventListener("input", () => {
                if (currentData) renderPrs(currentData.purchase_requests || [], currentData.is_admin);
            });
        }

        const grSearch = document.getElementById("wdGrSearch");
        if (grSearch) {
            grSearch.addEventListener("input", () => {
                if (currentData) renderGrns(currentData.goods_received || [], currentData.is_admin);
            });
        }

        // Export PRs from Dashboard
        const wdPrExportBtn = document.getElementById("wdPrExportBtn");
        if (wdPrExportBtn) {
            wdPrExportBtn.addEventListener("click", async () => {
                const originalContent = wdPrExportBtn.innerHTML;
                try {
                    wdPrExportBtn.disabled = true;
                    wdPrExportBtn.innerHTML = `
                        <svg class="spin-animation" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
                            <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="0.85"></path>
                        </svg>
                        <span>Exporting...</span>
                    `;
                    const params = new URLSearchParams();
                    if (currentPrFilterStatus && currentPrFilterStatus !== "ALL") {
                        params.set("status", currentPrFilterStatus);
                    }
                    const searchVal = prSearch ? prSearch.value.trim() : "";
                    if (searchVal) {
                        params.set("search", searchVal);
                    }
                    const queryStr = params.toString() ? `?${params.toString()}` : "";
                    const response = await apiFetch(`/purchase-requests/export${queryStr}`);
                    if (!response || !response.ok) {
                        throw new Error("Export failed");
                    }
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    const dateTag = new Date().toISOString().slice(0, 10);
                    const statusTag = currentPrFilterStatus && currentPrFilterStatus !== "ALL" ? `_${currentPrFilterStatus}` : "";
                    a.download = `Purchase_Requests_Export${statusTag}_${dateTag}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                } catch (err) {
                    alert("Failed to export Purchase Requests: " + (err.message || "Network error"));
                } finally {
                    wdPrExportBtn.disabled = false;
                    wdPrExportBtn.innerHTML = originalContent;
                }
            });
        }

        // Status filter pills
        document.querySelectorAll("#wdPrStatusFilter .wd-filter-pill").forEach(pill => {
            pill.addEventListener("click", () => {
                document.querySelectorAll("#wdPrStatusFilter .wd-filter-pill").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                currentPrFilterStatus = pill.dataset.status;
                if (currentData) renderPrs(currentData.purchase_requests || [], currentData.is_admin);
            });
        });
    }

    return {
        init,
        load: loadDashboard
    };
})();
