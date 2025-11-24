sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/m/ViewSettingsDialog",
  "sap/m/ViewSettingsItem",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/Label",
  "sap/m/Input",
  "sap/m/Select",
  "sap/ui/core/Item"
], function (Controller, MessageToast, MessageBox, ViewSettingsDialog, ViewSettingsItem, Filter, FilterOperator, Label, Input, Select, Item) {
  "use strict";

  return Controller.extend("zrapv4.controller.StudentList", {

    onInit: function () {
      this.oRouter = this.getOwnerComponent().getRouter();
      this.oRouter.getRoute("StudentList").attachPatternMatched(this._onRouteMatched, this);
      this.oTable = this.byId("StudentTable");
      // Store filters selected in dialog
      this._aSelectedFilterKeys = [];

      // Visibility model
      const oFilterVM = new sap.ui.model.json.JSONModel({
        Gender: false,
        Course: false,
        Status: false
      });

      this.getView().setModel(oFilterVM, "filterVisibility");
    },

      _onRouteMatched: function () {
      const oTable = this.byId("StudentTable");
      if (!oTable) return;

      // 🔥 Delay to allow RAP Activate(...) commit to finish
      setTimeout(() => {
        const oBinding = oTable.getBinding("items");
        if (oBinding) {
          console.log("Refreshing after draft activation…");
          oBinding.refresh();
        }
      }, 200);  // ← BEST VALUE (SAP recommended delay 150–300ms)
    },

    onRowNavigate: function (oEvent) {
      const oCtx = oEvent.getSource().getBindingContext();
      const sId = oCtx.getProperty("Id");
      this.oRouter.navTo("StudentDetail", { Id: sId });
    },

    onCreate: function () {
      const sTempId = this._generateUUID();
      this.oRouter.navTo("StudentDetail", { Id: sTempId });
    },

    _generateUUID: function () {
      return "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/[x]/g, () =>
        (Math.random() * 16 | 0).toString(16)
      ).toUpperCase();
    },
onDelete: async function () {
  const oModel = this.getView().getModel();
  const oTable = this.oTable;
  const aSelected = oTable.getSelectedItems();

  if (!aSelected.length) {
    return MessageToast.show("Select at least one student to delete.");
  }

  MessageBox.confirm(`Delete ${aSelected.length} selected student(s)?`, {
    onClose: async (sAction) => {
      debugger;
      if (sAction !== MessageBox.Action.OK) return;

      oTable.setBusy(true);

      const sGroupId = oModel.getUpdateGroupId() || "draftGroup";
      console.log("Using update group:", sGroupId);

      try {
        // Queue deletes
        aSelected.forEach((oItem) => {
          const oContext = oItem.getBindingContext();
          console.log("Deleting context:", oContext.getPath());
          oContext.delete(sGroupId);
        });

        // Send batch
        const oBatchResponse = await oModel.submitBatch(sGroupId);

        console.log("RAW BATCH RESPONSE:", oBatchResponse);

        // Detect success
        let iFailed = 0;

        const aBatch = oBatchResponse?.$batch || [];
        aBatch.forEach((oPart) => {
          const aOps = oPart.$changset || oPart.responses || [];
          aOps.forEach((oOp) => {
            const bSuccess = (oOp.success === true) ||
                             (oOp.response && oOp.response.status < 400);
            if (!bSuccess) iFailed++;
          });
        });

        if (iFailed > 0) {
          MessageBox.error(`${iFailed} delete operation(s) failed.`);
        } else {
          MessageToast.show(`${aSelected.length} deleted successfully.`);
        }

        oTable.getBinding("items").refresh();

      } catch (err) {
        console.error("SUBMIT ERROR:", err);
        MessageBox.error("Delete failed.");
      } finally {
        oTable.setBusy(false);
      }
    }
  });
},
    onRefresh: function () {
      this.oTable.getBinding("items").refresh();
    },

    // 🔍 Live filter for all visible inputs
    onFilterLive: function () {
      const aFilters = [];

      const sFirst = this.byId("inpFirstName")?.getValue() || "";
      const sAge = this.byId("inpAge")?.getValue() || "";
      const sGender = this.byId("inpGender")?.getSelectedKey?.() || "";
      const sCourse = this.byId("inpCourse")?.getValue?.() || "";
      const sStatus = this.byId("inpStatus")?.getSelectedKey?.() || "";

      if (sFirst) aFilters.push(new Filter("firstname", FilterOperator.Contains, sFirst));
      if (sAge) aFilters.push(new Filter("Age", FilterOperator.EQ, parseInt(sAge, 10)));
      if (sGender) aFilters.push(new Filter("Gender", FilterOperator.EQ, sGender));
      if (sCourse) aFilters.push(new Filter("Course", FilterOperator.Contains, sCourse));
      if (sStatus) aFilters.push(new Filter("Status", FilterOperator.EQ, sStatus === "true"));

      const oBinding = this.oTable.getBinding("items");
      if (oBinding) oBinding.filter(aFilters);
    },

    // ⚙️ Adapt Filters dialog
onOpenAdaptFilter: function () {
    if (!this._oAdaptDialog) {

        this._oAdaptDialog = new sap.m.Dialog({
            title: "Adapt Filters",
            contentWidth: "20rem",
            draggable: true,
            resizable: true,
            content: [
                new sap.m.List("adaptFilterList", {
                    mode: "MultiSelect",
                    includeItemInSelection: true,
                    items: [
                        new sap.m.StandardListItem({ title: "Gender", type: "Active", selected: false }),
                        new sap.m.StandardListItem({ title: "Course", type: "Active", selected: false }),
                        new sap.m.StandardListItem({ title: "Status", type: "Active", selected: false })
                    ]
                })
            ],
            beginButton: new sap.m.Button({
                text: "Apply",
                type: "Emphasized",
                press: () => {
                    const aSelectedItems = sap.ui.getCore().byId("adaptFilterList").getSelectedItems();
                    const aKeys = aSelectedItems.map(item => item.getTitle());

                    this._aSelectedFilterKeys = aKeys;

                    // Update visibility model
                    const oVM = this.getView().getModel("filterVisibility");
                    oVM.setData({
                        Gender: aKeys.includes("Gender"),
                        Course: aKeys.includes("Course"),
                        Status: aKeys.includes("Status")
                    });
                    oVM.updateBindings();

                    this._oAdaptDialog.close();
                }
            }),
            endButton: new sap.m.Button({
                text: "Cancel",
                press: () => this._oAdaptDialog.close()
            })
        });

        this.getView().addDependent(this._oAdaptDialog);
    }

    // Pre-select previously chosen filters
    const oList = sap.ui.getCore().byId("adaptFilterList");
    oList.removeSelections();

    oList.getItems().forEach(item => {
        if (this._aSelectedFilterKeys.includes(item.getTitle())) {
            item.setSelected(true);
        }
    });

    this._oAdaptDialog.open();
}

,

    // 🧠 Capture selected filters and render input fields dynamically
  onAdaptConfirm: function (oEvent) {

  const aSelected = oEvent.getParameters().filterItems || [];
  const aKeys = aSelected.map(item => item.getKey());
  this._aSelectedFilterKeys = aKeys;

  // Update filter visibility model
  const oFiltVM = this.getView().getModel("filterVisibility");

  oFiltVM.setData({
    Gender: aKeys.includes("Gender"),
    Course: aKeys.includes("Course"),
    Status: aKeys.includes("Status")
  });

  oFiltVM.updateBindings(); // refresh binding

  MessageToast.show("Filters added: " + (aKeys.join(", ") || "none"));
}


  });
});