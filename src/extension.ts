"use strict";

import * as path from "path";
import * as vscode from "vscode";
import {spawn, ChildProcess} from "child_process";

const OUTPUT_REGEXP = /.+: .+:([0-9]+): (.+) near.*[<'](.*)['>]/;

let diagnosticCollection: vscode.DiagnosticCollection;
let currentDiagnostic: vscode.Diagnostic;

function parseDocumentDiagnostics(document: vscode.TextDocument, luacOutput: string) {
    const matches = OUTPUT_REGEXP.exec(luacOutput);
    if (!matches) {
        return;
    }
    const message = {
        line: parseInt(matches[1]),
        text: matches[2],
        at: matches[3]
    }
    if (!message.line) {
        return;
    }

    var errorLine = document.lineAt(message.line - 1).text;

    var rangeLine = message.line - 1;
    var rangeStart = new vscode.Position(rangeLine, 0);
    var rangeEnd = new vscode.Position(rangeLine, errorLine.length);
    if (message.at !== "eof") {
        var linePosition = errorLine.indexOf(message.at);
        if (linePosition >= 0) {
            rangeStart = new vscode.Position(rangeLine, linePosition);
            rangeEnd = new vscode.Position(rangeLine, linePosition + message.at.length);
        }
    }
    var range = new vscode.Range(rangeStart, rangeEnd);
    currentDiagnostic = new vscode.Diagnostic(range, message.text, vscode.DiagnosticSeverity.Error);
}

function lintDocument(document: vscode.TextDocument, warnOnError: Boolean = false) {
    let lualinterConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('lualinter');
    if (!lualinterConfig.get("enable")) {
        return;
    }

    if (document.languageId !== "lua") {
        return;
    }
    currentDiagnostic = null;

    const options = {
        cwd: path.dirname(document.fileName)
    };

    // Determine the interpreter to use
    let interpreter = lualinterConfig.get<string>("interpreter");
    if ((interpreter !== "luac") && (interpreter !== "luajit")) {
        interpreter = "luac";
    }

    let cmd;
    if (interpreter === "luac") {
        cmd = "-p";
    } else {
        cmd = "-bl";
    }
    
    var luaProcess: ChildProcess = spawn(interpreter, [cmd, "-"], options);
    luaProcess.stdout.setEncoding("utf8");
    luaProcess.stderr.on("data", (data: Buffer) => {
        if (data.length == 0) {
            return;
        }
        parseDocumentDiagnostics(document, data.toString());
    });
    luaProcess.stderr.on("error", error => {
        vscode.window.showErrorMessage(interpreter + " error: " + error);
    });
    // Pass current file contents to lua's stdin
    luaProcess.stdin.end(new Buffer(document.getText()));
    luaProcess.on("exit", (code: number, signal: string) => {
        if (!currentDiagnostic) {
            diagnosticCollection.clear();
        } else {
            diagnosticCollection.set(document.uri, [currentDiagnostic]);

            // Optionally show warining message
            if (warnOnError && lualinterConfig.get<boolean>("warnOnSave")) {
                vscode.window.showWarningMessage("Current file contains an error: '${currentDiagnostic.message}' at line ${currentDiagnostic.range.start.line}");
            }
        }
    });
}

export function activate(context: vscode.ExtensionContext) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('lua');
    context.subscriptions.push(diagnosticCollection);

    vscode.workspace.onDidSaveTextDocument(document => lintDocument(document, true));
    vscode.workspace.onDidChangeTextDocument(event => lintDocument(event.document));
    vscode.workspace.onDidOpenTextDocument(document => lintDocument(document));
    vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor) => lintDocument(editor.document));
}