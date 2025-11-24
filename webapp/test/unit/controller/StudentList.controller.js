/*global QUnit*/

sap.ui.define([
	"zrapv4/controller/StudentList.controller"
], function (Controller) {
	"use strict";

	QUnit.module("StudentList Controller");

	QUnit.test("I should test the StudentList controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
