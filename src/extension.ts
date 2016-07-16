'use strict';

import * as path from 'path';
import * as vscode from 'vscode';
import {spawn} from 'child_process';

let diagnosticCollection: vscode.DiagnosticCollection;

function parseDocumentDiagnostics(document: vscode.TextDocument, luacOutput: string) {
    const regexp = /.+: .+:([0-9]+): (.+) near.*[<'](.*)['>]/;
    const matches = regexp.exec(luacOutput);
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
    if (message.at !== 'eof') {
        var linePosition = errorLine.indexOf(message.at);
        if (linePosition >= 0) {
            rangeStart = new vscode.Position(rangeLine, linePosition);
            rangeEnd = new vscode.Position(rangeLine, linePosition + message.at.length);
        }
    }
    var range = new vscode.Range(rangeStart, rangeEnd);
    var diagnostic = new vscode.Diagnostic(range, message.text, vscode.DiagnosticSeverity.Error);
    diagnosticCollection.set(document.uri, [diagnostic]);
}

function lintDocument(document: vscode.TextDocument) {
    if (document.languageId !== 'lua') {
        return;
    }

    const luacCommand = 'luac';
    const options = {
        cwd: path.dirname(document.fileName)
    };

    diagnosticCollection.clear();
    var luac = spawn(luacCommand, ['-p', '-'], options);
    luac.stdout.setEncoding('utf8');
    luac.stderr.on('data', (data: Buffer) => {
        if (data.length == 0) {
            return;
        }
        parseDocumentDiagnostics(document, data.toString());
    });
    luac.stderr.on('error', error => {
        vscode.window.showErrorMessage('luac error: ' + error);
    });
    luac.stdin.end(new Buffer(document.getText()));
}

export function activate(context: vscode.ExtensionContext) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection('lua');
    context.subscriptions.push(diagnosticCollection);

    vscode.workspace.onDidSaveTextDocument(document => lintDocument(document));
    vscode.workspace.onDidChangeTextDocument(event => lintDocument(event.document));
    vscode.workspace.onDidOpenTextDocument(document => lintDocument(document));
}