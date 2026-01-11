/* ================= DIALOG (GLOBAL) ================= */

let currentTable = null;
let currentSelectId = null;

window.openDialog = function (table, selectId) {
  currentTable = table;
  currentSelectId = selectId;

  document.getElementById("dialogInput").value = "";
  document.getElementById("dialogTitle").innerText = "Додати";

  document.getElementById("dictDialog").classList.remove("hidden");
};

window.closeDialog = function () {
  document.getElementById("dictDialog").classList.add("hidden");
};

window.confirmDialog = async function () {
  const value = document.getElementById("dialogInput").value.trim();
  if (!value) return;

  const { error } = await supabaseClient
    .from(currentTable)
    .insert({ name: value });

  if (error) {
    alert(error.message);
    return;
  }

  await loadSelect(currentTable, currentSelectId);
  document.getElementById(currentSelectId).value = value;

  window.closeDialog();
};
