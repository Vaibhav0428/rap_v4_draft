
sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/BindingMode"
], function (Controller, MessageToast, MessageBox, JSONModel, BindingMode) {
  "use strict";

  return Controller.extend("zrapv4.controller.StudentDetail", {

    /* ====================================================== */
    /* INIT: Create persistent JSON model                     */
    /* ====================================================== */
    onInit: function () {
      this.oRouter = this.getOwnerComponent().getRouter();

      this._msgManager = sap.ui.getCore().getMessageManager();
      this._msgManager.registerObject(this.getView(), true);

      // 🔧 Create one reusable JSON model for all navigations
      this.oVM = new JSONModel({
        Id: "",
        firstname: "",
        Lastname: "",
        Age: 0,
        Course: "",
        Gender: "",
        Status: false,
        _Attachments: []
      });
      this.oVM.setDefaultBindingMode(BindingMode.TwoWay);

      // Attach model once
      this.getView().setModel(this.oVM, "vm");

      // Route handling
      this.oRouter.getRoute("StudentDetail").attachPatternMatched(this._onRouteMatched, this);
    },

    /* ====================================================== */
    /* ROUTE MATCHED: Load backend or initialize new record    */
    /* ====================================================== */
    _onRouteMatched: async function (oEvent) {
      debugger;
      const sId = oEvent.getParameter("arguments").Id;
      const oView = this.getView();
      const oOData = oView.getModel();
      oView.setBusy(true);

      this._isLocal = true;
      this.draft = false;
      this._draftPath = "";

      this.oVM.setData({
        Id: "",
        firstname: "",
        Lastname: "",
        Age: 0,
        Course: "",
        Gender: "",
        Status: false,
        _Attachments: []
      });

      try {
        const sPath = `/ZSTUDENT_HDR_TAB_P_new(Id=${sId},IsActiveEntity=true)`;
        oView.bindElement({ path: sPath });
        console.log("📡 Fetching student:", sPath);

        const oCtx = oOData.bindContext(sPath);
        const oData = await oCtx.requestObject();

        if (oData && oData.Id) {
          console.log("✅ Loaded student:", oData);

          this._isLocal = false;       

          const oAttachList = oOData.bindList(`${sPath}/_Attachments`);
          const aAttachCtx = await oAttachList.requestContexts(0, Infinity);
       const serviceUrl = this.getView().getModel().sServiceUrl;

          const aAttachments = aAttachCtx.map(ctx => {
              const obj = ctx.getObject();
              const rel = obj["Attachment@odata.mediaReadLink"];

              obj.mediaUrl = rel ? serviceUrl + rel : "";
              obj.mediaType = obj["Attachment@odata.mediaContentType"];

              return obj;
});


          // const aAttachments = aAttachCtx.map(c => c.getObject());

          console.log("📎 Loaded attachments:", aAttachments);


          // Simply update the existing JSONModel data
          this.oVM.setData({
            Id: oData.Id,
            firstname: oData.firstname || "",
            Lastname: oData.Lastname || "",
            Age: oData.Age || 0,
            Course: oData.Course || "",
            Gender: oData.Gender || "",
            Status: oData.Status || false,
            _Attachments: aAttachments || []
          });
          // UI auto-updates — no rebinding or applyChanges needed
          console.log("🎯 firstname (model):", this.oVM.getProperty("/firstname"));
        } else {
          console.log("🟢 New entry, initializing local data.");
          this._isLocal = true;
          this.oVM.setData({
            Id: sId,
            firstname: "",
            Lastname: "",
            Age: 0,
            Course: "",
            Gender: "",
            Status: false,
            _Attachments: []
          });
        }

      } catch (err) {
        console.error("❌ Backend error:", err);
       // MessageBox.error("Unable to load student: " + err.message);
      } finally {
        oView.setBusy(false);
      }
    },

    /* ====================================================== */
    /* ADD ATTACHMENT                                         */
    /* ====================================================== */
    onAddAttachment: function () {
      const oVM = this.getView().getModel("vm");
      const aAttachments = oVM.getProperty("/_Attachments") || [];

      const sNewAttachId = "ATT-" + (aAttachments.length + 1).toString().padStart(3, "0");
      aAttachments.push({
        AttachId: sNewAttachId,
        // Id: oVM.getProperty("/Id"),
        Comments: "",
        Filename: "",
        Mimetype: "",
        Attachment : ""
      });

      oVM.setProperty("/_Attachments", aAttachments);
      MessageToast.show("Attachment added.");
    },

    /* ====================================================== */
    /* DELETE ATTACHMENT                                      */
    /* ====================================================== */
    onDeleteAttachment: function () {
      const oTable = this.byId("AttachmentTable");
      const oSelected = oTable.getSelectedItem();
      if (!oSelected) {
        MessageToast.show("Select an attachment to delete.");
        return;
      }

      const oCtx = oSelected.getBindingContext("vm");
      const iIndex = parseInt(oCtx.getPath().split("/").pop(), 10);
      const aData = oCtx.getModel().getProperty("/_Attachments");
      aData.splice(iIndex, 1);
      oCtx.getModel().setProperty("/_Attachments", aData);

      MessageToast.show("Attachment deleted.");
    },

onSave: async function () {
  debugger;
  const oView = this.getView();
  const oModel = oView.getModel();
  const oVM = oView.getModel("vm");
  const d = oVM.getData();
  oView.setBusy(true);
  try {

    /* ====================================================== */
    /* CASE 1 — FIRST CREATE (no draft exists yet)            */
    /* ====================================================== */
    if (this._isLocal && !this.draft) {

      const oList = oModel.bindList("/ZSTUDENT_HDR_TAB_P_new", null, [], [], {
        $$updateGroupId: "$auto"
      });

      const oCtx = oList.create({
        firstname: d.firstname,
        Lastname: d.Lastname,
        Age: Number(d.Age),
        Course: d.Course,
        Gender: d.Gender,
        Status: d.Status,
        _Attachments: d._Attachments
      });

      await oCtx.created();
      // store draft path
      this._draftPath = oCtx.getPath();
      this.draft = true;

      // ACTIVATE draft
      const oActivate = oModel.bindContext(
        `${this._draftPath}/com.sap.gateway.srvd.zsrd_upload_managed.v0001.Activate(...)`,
        null,
        { $$updateGroupId: "$auto" }
      );

      await oActivate.execute();

      // Reset
      this.draft = false;
      this._isLocal = false;

      MessageToast.show("Student created successfully.");
    }

    /* ====================================================== */
    /* CASE 2 — VALIDATION FAILED BEFORE → REUSE SAME DRAFT   */
    /* ====================================================== */
    else if (this._isLocal && this.draft) {

          // 1) get the binding for the draft path
    const oDraftBinding = oModel.bindContext(this._draftPath);

    // 2) ensure the data is loaded
    await oDraftBinding.requestObject();

    // 3) get the bound Context object (this has setProperty)
    const oDraftCtx = oDraftBinding.getBoundContext();

    // 4) update properties on the Context
    oDraftCtx.setProperty("firstname", d.firstname);
    oDraftCtx.setProperty("Lastname", d.Lastname);
    oDraftCtx.setProperty("Age", Number(d.Age));
    oDraftCtx.setProperty("Course", d.Course);
    oDraftCtx.setProperty("Gender", d.Gender);
    oDraftCtx.setProperty("Status", d.Status);

    // 5) attachments operate on list binding relative to the binding's context
    const oAttachList = oModel.bindList(`${this._draftPath}/_Attachments`, oDraftBinding, [], [], { $$updateGroupId: "$auto" });
    const aExisting = await oAttachList.requestContexts(0, Infinity);
    for (const ctx of aExisting) {
      await ctx.delete().catch(() => {});
    }
    for (const att of d._Attachments || []) {
      oAttachList.create({
        AttachId: att.AttachId,
        Comments: att.Comments,
        Filename: att.Filename,
        Mimetype: att.Mimetype
      });
    }

      // ACTIVATE same draft
      const oActivate = oModel.bindContext(
        `${this._draftPath}/com.sap.gateway.srvd.zsrd_upload_managed.v0001.Activate(...)`,
        null,
        { $$updateGroupId: "$auto" }
      );

      await oActivate.execute();

      // Reset
      this.draft = false;
      this._isLocal = false;

      MessageToast.show("Student created successfully.");
    }

    // ======================================================
    //  CASE 3: UPDATE EXISTING ENTRY (active → draft → active)
    // ======================================================

else {

    const sActivePath =
        `/ZSTUDENT_HDR_TAB_P_new(Id=${d.Id},IsActiveEntity=true)`;

    // Load active entity
    const oActiveCtxBinding = oModel.bindContext(sActivePath);
    const oActiveData = await oActiveCtxBinding.requestObject();

    /* ---------------------------------------------------------
       1) If no draft exists → call Edit to create one
       --------------------------------------------------------- */
    if (!oActiveData.HasDraftEntity) {

        const oEdit = oModel.bindContext(
            `${sActivePath}/com.sap.gateway.srvd.zsrd_upload_managed.v0001.Edit(...)`,
            null,
            { $$updateGroupId: "$auto" }
        );

        oEdit.setParameter("PreserveChanges", false);
        await oEdit.execute();
    }

    /* ---------------------------------------------------------
       2) Load REAL draft instance (IsActiveEntity=false)
       --------------------------------------------------------- */
    const sDraftPath =
        `/ZSTUDENT_HDR_TAB_P_new(Id=${d.Id},IsActiveEntity=false)`;

    const oDraftBinding = oModel.bindContext(sDraftPath);
    await oDraftBinding.requestObject();
    const oDraftCtx = oDraftBinding.getBoundContext();

    /* ---------------------------------------------------------
       3) Update draft properties
       --------------------------------------------------------- */
    oDraftCtx.setProperty("firstname", d.firstname);
    oDraftCtx.setProperty("Lastname", d.Lastname);
    oDraftCtx.setProperty("Age", Number(d.Age));
    oDraftCtx.setProperty("Course", d.Course);
    oDraftCtx.setProperty("Gender", d.Gender);
    oDraftCtx.setProperty("Status", d.Status);

    /* ---------------------------------------------------------
       4) Update draft attachments
       --------------------------------------------------------- */
    const oAttachList = oModel.bindList(
        `${sDraftPath}/_Attachments`,
        oDraftCtx,
        [],
        [],
        { $$updateGroupId: "$auto" }
    );

    const aExisting = await oAttachList.requestContexts(0, Infinity);

    for (const ctx of aExisting) {
        try { await ctx.delete(); } catch (e) {}
    }

    for (const att of (d._Attachments || [])) {
        oAttachList.create({
            AttachId: att.AttachId,
            Comments: att.Comments,
            Filename: att.Filename,
            Mimetype: att.Mimetype,
            Attachment : att.Attachment
        });
    }

    /* ---------------------------------------------------------
       5) Activate draft
       --------------------------------------------------------- */
    const oActivate = oModel.bindContext(
        `${sDraftPath}/com.sap.gateway.srvd.zsrd_upload_managed.v0001.Activate(...)`,
        oDraftCtx,
        { $$updateGroupId: "$auto" }
    );

    await oActivate.execute();

    MessageToast.show("Student updated successfully.");
}



    // NAVIGATE
    this.getOwnerComponent().getRouter().navTo("StudentList");
  }
  catch (err) {
    console.error("❌ Backend Validation/Error:", err);

    // Extract RAP messages safely
    const aMessages =
        err?.error?.details ||       // SAP RAP detail list (correct)
        err?.error?.innererror?.errordetails ||   // fallback
        [];

    // If backend sent multiple messages → show them in MessagePopover
    if (aMessages.length > 0) {

        // Add each message to UI Message Manager
        aMessages.forEach(msg => {
            this._msgManager.addMessages(
                new sap.ui.core.message.Message({
                    message: msg.message || msg.longtext_url || "Unknown error",
                    type: sap.ui.core.MessageType.Error,
                    persistent: true,
                    target: "",           // use "" for global errors
                    processor: this.getView().getModel()
                })
            );
        });

        // Show popup with *all* errors
        sap.m.MessageBox.error(
            "Please fix the highlighted errors.\n\n" +
            aMessages.map(m => "- " + m.message).join("\n")
        );

    } else {
        // fallback single error
        sap.m.MessageBox.error(err.message || "Unknown error");
    }
}
  finally {
    oView.setBusy(false);
  }
}



    ,
    /* ====================================================== */
    /* NAVIGATION BACK                                        */
    /* ====================================================== */
    onNavBack: function () {
      this.oRouter.navTo("StudentList");
    }
  });
});
