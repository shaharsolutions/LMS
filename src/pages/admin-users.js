import { fetchUsers, createUser, deleteUser, updateUser, bulkUpdateUsersOrg } from '../api/usersApi.js'
import { resetUserProgress, resetOrgProgress } from '../api/progressApi.js'
import { fetchGroups, assignUsersToGroup } from '../api/groupsApi.js'
import { getCurrentUserSync } from '../api/authApi.js'
import { showConfirmModal, showToast, showBulkGroupModal, showBulkOrgModal } from '../lib/ui.js'
import { fetchOrganizations } from '../api/orgApi.js'

export default async function renderAdminUsers(container) {
  const currentUser = getCurrentUserSync();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  let organizations = [];

  if (isSuperAdmin) {
    try {
        organizations = await fetchOrganizations();
    } catch (e) {
        console.error("Failed to fetch organizations", e);
    }
  }

  // === Bulk Selection State & Logic ===
  let selectedUserIds = new Set();
  
  function updateBulkBar() {
    const bulkBar = container.querySelector('#bulk-actions-bar');
    const countSpan = container.querySelector('#selected-count');
    const selectAllCb = container.querySelector('#select-all-users');
    
    if (!bulkBar || !countSpan) return;

    // Scan all checkboxes manually for the most reliable state
    const allCheckboxes = Array.from(container.querySelectorAll('.user-checkbox'));
    const checked = allCheckboxes.filter(cb => cb.checked);
    const count = checked.length;

    // Update internal state set
    selectedUserIds.clear();
    checked.forEach(cb => {
      if (cb.dataset.id) selectedUserIds.add(cb.dataset.id);
    });

    if (count > 0) {
      bulkBar.classList.remove('hidden');
      bulkBar.style.display = 'block';
      countSpan.innerText = count === 1 ? 'משתמש 1 נבחר' : `${count} משתמשים נבחרו`;
    } else {
      bulkBar.classList.add('hidden');
      bulkBar.style.display = 'none';
      countSpan.innerText = '0 משתמשים נבחרו';
      if (selectAllCb) selectAllCb.checked = false;
    }
  }

  container.innerHTML = `
    <div class="mb-4 fade-in">
      <h1 class="mb-1">${isSuperAdmin ? 'ניהול משתמשים כלל מערכתי' : 'ניהול עובדי הארגון'}</h1>
      <p class="text-muted">הוספה, אימות ומחיקה של משתמשים המורשים להיכנס למערכת.</p>
    </div>

    <div id="bulk-actions-bar" class="card mb-4 slide-up hidden" style="background: hsl(var(--color-primary)/0.05); border: 1px dashed hsl(var(--color-primary)); padding: 1rem 1.5rem;">
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <i class='bx bx-check-square' style="font-size: 1.5rem; color: hsl(var(--color-primary));"></i>
            <span class="font-bold" id="selected-count" style="font-size: 0.95rem;">0 משתמשים נבחרו</span>
          </div>
          <div style="width: 1px; height: 24px; background: hsla(var(--text-main), 0.1);"></div>
          <button class="btn btn-primary text-sm" id="bulk-group-btn">
            <i class='bx bx-group'></i> הוסף לקבוצה
          </button>
          ${isSuperAdmin ? `
          <button class="btn btn-outline text-sm" id="bulk-move-org-btn">
            <i class='bx bx-transfer'></i> העברה לארגון אחר
          </button>
          ` : ''}
          <button class="btn btn-outline text-sm text-danger" id="bulk-delete-btn" style="color: hsl(var(--color-danger)); border-color: hsla(var(--color-danger), 0.3);">
            <i class='bx bx-trash'></i> מחיקה קבוצתית
          </button>
        </div>
        <button class="btn btn-outline text-sm" id="clear-selection-btn">ביטול בחירה</button>
      </div>
    </div>

    <div class="grid grid-cols-3 slide-up" style="gap: 1.5rem; align-items: start;">
       <!-- Add User Form Section -->
       <div class="card" style="grid-column: span 1;">
         <h3 class="mb-3" id="form-title">יצירת משתמש חדש</h3>
         <form id="user-create-form">
            <div class="form-group" style="text-align: right;">
               <label class="form-label" for="user-name">שם מלא <span style="color: hsl(var(--color-danger));">*</span></label>
               <input class="form-control" type="text" id="user-name" required placeholder="לדוגמה: משה כהן">
            </div>
            <div class="form-group" style="text-align: right;">
               <label class="form-label" for="user-email">כתובת אימייל <span style="color: hsl(var(--color-danger));">*</span></label>
               <input class="form-control" type="email" id="user-email" required placeholder="moshe@company.com">
            </div>
            <div class="form-group" style="text-align: right;">
               <label class="form-label" for="user-phone">מספר טלפון</label>
               <input class="form-control" type="tel" id="user-phone" placeholder="050-0000000">
            </div>
            <div class="form-group" style="text-align: right;">
               <label class="form-label" for="user-password">סיסמה לעובד <span style="color: hsl(var(--color-danger));">*</span></label>
               <input class="form-control" type="text" id="user-password" required placeholder="לפחות 6 תווים">
            </div>
            
            ${isSuperAdmin ? `
            <div class="form-group" style="text-align: right;">
               <label class="form-label" for="user-org">שיוך לארגון</label>
               <select class="form-control" id="user-org">
                  <option value="">-- בחר ארגון --</option>
                  ${organizations.map(o => `<option value="${o.id}">${o.name}</option>`).join('')}
               </select>
            </div>
            ` : ''}

            <div class="form-group" style="text-align: right;">
               <label class="form-label" for="user-role">תפקיד במערכת</label>
               <select class="form-control" id="user-role">
                  <option value="learner">לומד (Learner)</option>
                  <option value="org_admin">מנהל הדרכה (Admin)</option>
               </select>
            </div>
            
            <button type="submit" class="btn btn-primary w-full justify-center mt-4" id="submit-btn" style="transition: all 0.3s ease;">
              <i class='bx bx-user-plus'></i> <span>צור חשבון ושגר הזמנה</span>
            </button>
            <button type="button" class="btn btn-outline w-full justify-center mt-2 hidden" id="cancel-edit-btn">
              ביטול עריכה
            </button>
            <div id="user-msg" style="margin-top: 10px; text-align: center; font-weight: 500; min-height: 20px;" class="text-sm"></div>
         </form>
       </div>

       <!-- Table Section -->
       <div class="card table-wrapper" style="grid-column: span 2;">
          <div class="flex justify-between items-center mb-3">
             <h3 class="m-0">רשימת משתמשים פעילים</h3>
             ${!isSuperAdmin ? `
             <button class="btn btn-outline text-sm" id="reset-all-org-progress" style="color: hsl(var(--color-danger)); border-color: hsla(var(--color-danger), 0.3);">
                <i class='bx bx-refresh'></i> איפוס כלל הנתונים בארגון
             </button>
             ` : ''}
          </div>
         <table class="table" id="users-table">
            <thead>
                <tr>
                   <th style="width: 40px;"><input type="checkbox" id="select-all-users"></th>
                   <th>שם מלא</th>
                   <th>אימייל / הרשאה</th>
                   ${isSuperAdmin ? '<th>ארגון</th>' : ''}
                   <th>סטטוס</th>
                   <th>תאריך הצטרפות</th>
                   <th>פעולות</th>
                </tr>
            </thead>
            <tbody>
               <tr><td colspan="${isSuperAdmin ? 7 : 6}" style="text-align: center;"><i class='bx bx-loader bx-spin'></i> טוען משתמשים...</td></tr>
            </tbody>
         </table>
       </div>
    </div>
  `

  const tableBody = container.querySelector('#users-table tbody')

  async function renderTable() {
    try {
      const users = await fetchUsers()
      console.log(`[LMS] renderTable - Users:`, users);
      
      const checkUser = getCurrentUserSync();
      if (!checkUser) {
          console.warn(`[LMS] renderTable - No current user during render, skipping table update`);
          return;
      }

      if (users.length === 0) {
        console.log(`[LMS] renderTable - No users found for role ${checkUser.role} in org ${checkUser.orgId}`);
        tableBody.innerHTML = `<tr><td colspan="${isSuperAdmin ? 7 : 6}" style="text-align: center;" class="text-muted">אין משתמשים במערכת</td></tr>`
        return
      }

      console.log(`[LMS] renderTable - Generating HTML for ${users.length} users`);
      const html = users.map(u => {
        try {
          return `
            <tr data-user-id="${u.id}">
               <td><input type="checkbox" class="user-checkbox" data-id="${u.id}" data-name="${u.full_name}" ${selectedUserIds.has(u.id) ? 'checked' : ''}></td>
               <td>
                  <div style="font-weight: 500;">${u.full_name}</div>
                  <div class="user-groups-list flex gap-1 mt-1 flex-wrap">
                    ${u.groups?.length > 0 
                      ? u.groups.map(g => `<span class="badge" style="font-size: 0.65rem; background: hsla(var(--color-primary), 0.1); color: hsl(var(--color-primary)); border: 1px solid hsla(var(--color-primary), 0.2);">${g.name}</span>`).join('') 
                      : '<span class="badge" style="font-size: 0.65rem; background: hsla(var(--color-primary), 0.1); color: hsl(var(--color-primary)); border: 1px solid hsla(var(--color-primary), 0.2);">לא משויך לקבוצה</span>'}
                  </div>
               </td>
               <td>
                  ${u.email || '-'} <br>
                  <span class="text-xs text-muted">
                    ${u.phone || 'אין טלפון'} • 
                    ${u.role === 'org_admin' ? 'מנהל הדרכה' : u.role === 'super_admin' ? 'מנהל על' : 'עובד / לומד'}
                  </span>
               </td>
               ${isSuperAdmin ? `<td><span class="text-sm">${u.org_name || '-'}</span></td>` : ''}
               <td><span class="badge ${u.status === 'פעיל' ? 'badge-success' : 'badge-warning'}">${u.status || 'פעיל'}</span></td>
               <td>${u.created_at ? new Date(u.created_at).toLocaleDateString('he-IL') : '-'}</td>
               <td>
                 <div class="flex gap-2">
                   <button class="btn btn-outline text-sm edit-btn" 
                     data-id="${u.id}" 
                     data-name="${u.full_name}" 
                     data-phone="${u.phone || ''}" 
                     data-email="${u.email || ''}" 
                     data-role="${u.role}" 
                     data-org="${u.org_id || ''}"
                     title="עריכת משתמש"><i class='bx bx-edit'></i></button>
                   <button class="btn btn-outline text-sm reset-user-btn" data-id="${u.id}" data-name="${u.full_name}" title="איפוס נתוני למידה"><i class='bx bx-refresh' style="color: hsl(var(--color-warning));"></i></button>
                   <button class="btn btn-outline text-sm delete-btn" data-id="${u.id}" data-name="${u.full_name}" title="מחיקת חשבון"><i class='bx bx-trash' style="color: hsl(var(--color-danger));"></i></button>
                 </div>
               </td>
            </tr>
          `;
        } catch (e) {
          console.error(`[LMS] Error rendering user ${u.id}:`, e);
          return '';
        }
      }).join('');
      
      console.log(`[LMS] renderTable - HTML generated, length: ${html.length}`);
      tableBody.innerHTML = html;

      // Setup edit buttons
      container.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const btnEl = e.currentTarget;
          const form = document.getElementById('user-create-form');
          
          document.getElementById('form-title').innerText = 'עריכת משתמש';
          document.getElementById('user-name').value = btnEl.getAttribute('data-name');
          document.getElementById('user-phone').value = btnEl.getAttribute('data-phone');
          document.getElementById('user-email').value = btnEl.getAttribute('data-email') !== '---' && btnEl.getAttribute('data-email') ? btnEl.getAttribute('data-email') : '';
          document.getElementById('user-email').disabled = false; 
          document.getElementById('user-role').value = btnEl.getAttribute('data-role');
          
          if (isSuperAdmin) {
            document.getElementById('user-org').value = btnEl.getAttribute('data-org');
          }

          const pwField = document.getElementById('user-password');
          pwField.required = false;
          pwField.placeholder = 'אופציונלי: השאר ריק עבור סיסמה נוכחית';
          pwField.value = '';

          form.dataset.editId = btnEl.getAttribute('data-id');
          
          const submitBtn = document.getElementById('submit-btn');
          submitBtn.querySelector('i').className = 'bx bx-save';
          submitBtn.querySelector('span').innerText = 'שמור שינויים';
          
          document.getElementById('cancel-edit-btn').classList.remove('hidden');
          document.getElementById('form-title').scrollIntoView({ behavior: 'smooth' });
        });
      });

      // Setup delete buttons
      container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          const name = e.currentTarget.getAttribute('data-name');
          
          await showConfirmModal({
            title: 'מחיקת משתמש',
            message: `האם אתה בטוח שברצונך למחוק את <strong>${name}</strong>? פעולה זו תסיר את הגישה שלו לצמיתות.`,
            confirmText: 'מחק חשבון',
            onConfirm: async () => {
                await deleteUser(id);
                showToast('המשתמש נמחק בהצלחה');
                renderTable();
            }
          });
        });
      });

      // Setup individual reset buttons
      container.querySelectorAll('.reset-user-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          const name = e.currentTarget.getAttribute('data-name');
          
          await showConfirmModal({
            title: 'אישור איפוס נתונים',
            message: `האם אתה בטוח שברצונך לאפס את כל נתוני הלמידה עבור <strong>${name}</strong>? פעולה זו תמחוק את כל ציוני הלומדות שלו לצמיתות.`,
            confirmText: 'אפס נתונים',
            onConfirm: async () => {
                await resetUserProgress(id);
                showToast(`נתוני הלמידה של ${name} אופסו`);
                renderTable();
            }
          });
        })
      })

      // Setup Org-wide reset button
      const resetAllBtn = container.querySelector('#reset-all-org-progress');
      if (resetAllBtn) {
        resetAllBtn.addEventListener('click', async () => {
          await showConfirmModal({
            title: 'אזהרה קריטית!',
            message: 'אתה עומד לאפס את <strong>כל נתוני הלמידה</strong> של כל העובדים בארגון. פעולה זו אינה הפיכה! האם להמשיך?',
            confirmText: 'אפס הכל (קריטי)',
            onConfirm: async () => {
                await resetOrgProgress(currentUser.orgId);
                showToast('כל נתוני הלמידה בארגון אופסו');
                renderTable();
            }
          });
        })
      }
    } catch (err) {
      tableBody.innerHTML = `<tr><td colspan="${isSuperAdmin ? 7 : 6}" style="color: hsl(var(--color-danger)); text-align: center;">שגיאה: ${err.message}</td></tr>`
    }
  }

  await renderTable()

  // Form Reset Helper
  const resetFormToCreate = () => {
    form.reset()
    document.getElementById('form-title').innerText = 'יצירת משתמש חדש'
    document.getElementById('user-email').disabled = false
    const pwField = document.getElementById('user-password')
    pwField.required = true
    pwField.placeholder = 'לפחות 6 תווים'
    delete form.dataset.editId
    
    const submitBtn = document.getElementById('submit-btn')
    submitBtn.querySelector('i').className = 'bx bx-user-plus'
    submitBtn.querySelector('span').innerText = 'צור חשבון ושגר הזמנה'
    document.getElementById('cancel-edit-btn').classList.add('hidden')
  }

  // Handle Cancel Edit
  container.querySelector('#cancel-edit-btn').addEventListener('click', () => {
    resetFormToCreate()
    document.getElementById('user-msg').innerHTML = ''
  })

  // Handle Create/Update User
  const form = container.querySelector('#user-create-form')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const msg = document.getElementById('user-msg')
    const submitBtn = form.querySelector('button[type="submit"]')
    const isEdit = !!form.dataset.editId
    
    const userData = {
      fullName: document.getElementById('user-name').value,
      email: document.getElementById('user-email').value,
      phone: document.getElementById('user-phone').value,
      password: document.getElementById('user-password').value,
      role: document.getElementById('user-role').value
    }

    if (isSuperAdmin) {
        userData.orgId = document.getElementById('user-org').value;
        if (!userData.orgId && userData.role !== 'super_admin') {
            msg.style.color = 'hsl(var(--color-danger))';
            msg.innerHTML = 'עליך לבחור ארגון עבור משתמש שאינו מנהל על.';
            return;
        }
    }

    if (userData.phone) {
      const phoneRegex = /^05\d-?\d{7}$/;
      if (!phoneRegex.test(userData.phone)) {
        msg.style.color = 'hsl(var(--color-danger))';
        msg.innerHTML = 'שגיאה: מספר טלפון לא תקין.';
        setTimeout(() => { msg.innerHTML = '' }, 4000);
        return;
      }
    }

    submitBtn.disabled = true
    submitBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> <span>מבצע...</span>`
    
    try {
      if (isEdit) {
        await updateUser(form.dataset.editId, userData);
        showToast('פרטי המשתמש עודכנו');
      } else {
        await createUser(userData);
        showToast('המשתמש הוקם בהצלחה');
      }
      
      await renderTable();
      resetFormToCreate();
    } catch (err) {
      msg.style.color = 'hsl(var(--color-danger))';
      msg.innerHTML = 'שגיאה: ' + err.message;
    } finally {
      submitBtn.disabled = false
      submitBtn.innerHTML = isEdit 
      ? `<i class='bx bx-save'></i> <span>שמור שינויים</span>`
      : `<i class='bx bx-user-plus'></i> <span>צור חשבון ושגר הזמנה</span>`
    }
  })

  // Initialize selection bar state
  updateBulkBar();

  // Handle Selection Change
  container.addEventListener('change', (e) => {
    const target = e.target;
    
    // 1. Select All Checkbox
    if (target.id === 'select-all-users') {
      const isChecked = target.checked;
      container.querySelectorAll('.user-checkbox').forEach(cb => {
        cb.checked = isChecked;
      });
      updateBulkBar();
    } 
    // 2. Individual Checkbox
    else if (target.classList.contains('user-checkbox')) {
      // Update Select All checkbox state based on others
      const allCb = Array.from(container.querySelectorAll('.user-checkbox'));
      const selectAll = container.querySelector('#select-all-users');
      if (selectAll) {
        selectAll.checked = allCb.every(cb => cb.checked);
        selectAll.indeterminate = !selectAll.checked && allCb.some(cb => cb.checked);
      }
      updateBulkBar();
    }
  });

  // Remove the redundant click listener that was causing conflicts
  // container.addEventListener('click', (e) => { ... });

  // Handle 'Clear Selection' button in the bulk bar
  container.querySelector('#clear-selection-btn').addEventListener('click', () => {
    container.querySelectorAll('.user-checkbox, #select-all-users').forEach(cb => cb.checked = false);
    updateBulkBar();
  });

  // Bulk Group Assignment
  container.querySelector('#bulk-group-btn').addEventListener('click', async () => {
    try {
      if (selectedUserIds.size === 0) return;

      const groups = await fetchGroups();
      const usersSelection = Array.from(selectedUserIds).map(id => {
          const row = tableBody.querySelector(`tr[data-user-id="${id}"]`);
          const cb = row ? row.querySelector('.user-checkbox') : null;
          return { id, full_name: cb?.dataset.name || 'משתמש' };
      });

      await showBulkGroupModal({
        users: usersSelection,
        groups: groups,
        onAssign: async (groupId) => {
            await assignUsersToGroup(groupId, Array.from(selectedUserIds));
            showToast('המשתמשים שוייכו לקבוצה בהצלחה');
            selectedUserIds.clear();
            container.querySelectorAll('.user-checkbox, #select-all-users').forEach(cb => cb.checked = false);
            updateBulkBar();
        }
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Bulk Delete
  container.querySelector('#bulk-delete-btn').addEventListener('click', async () => {
    await showConfirmModal({
        title: 'מחיקה קבוצתית',
        message: `האם אתה בטוח שברצונך למחוק לצמיתות את <strong>${selectedUserIds.size}</strong> המשתמשים שנבחרו? פעולה זו אינה הפיכה.`,
        confirmText: 'מחק הכל',
        onConfirm: async () => {
            const promises = Array.from(selectedUserIds).map(id => deleteUser(id));
            await Promise.all(promises);
            showToast('המשתמשים נמחקו בהצלחה');
            selectedUserIds.clear();
            updateBulkBar();
            renderTable();
        }
    });
  });

  // Bulk Move Org
  const bulkMoveBtn = container.querySelector('#bulk-move-org-btn');
  if (bulkMoveBtn) {
    bulkMoveBtn.addEventListener('click', async () => {
      const usersSelection = Array.from(selectedUserIds).map(id => {
          const row = tableBody.querySelector(`tr[data-user-id="${id}"]`);
          const cb = row.querySelector('.user-checkbox');
          return { id, full_name: cb?.dataset.name || 'משתמש' };
      });

      await showBulkOrgModal({
        users: usersSelection,
        organizations,
        onAssign: async (newOrgId) => {
            await bulkUpdateUsersOrg(Array.from(selectedUserIds), newOrgId);
            showToast('המשתמשים הועברו בהצלחה לארגון החדש');
            selectedUserIds.clear();
            updateBulkBar();
            renderTable();
        }
      });
    });
  }
}
