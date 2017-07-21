/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../parser/cssNodes';
import {TextDocument, Range, Diagnostic, DiagnosticSeverity} from 'vscode-languageserver-types-commonjs';
import {ILintConfigurationSettings, sanitize} from './lintRules';
import {LintVisitor} from './lint';
import {LanguageSettings} from '../cssLanguageService';

export class CSSValidation {

	private lintSettings: ILintConfigurationSettings;
	private validationEnabled: boolean;

	constructor() {
	}

	public configure(raw: LanguageSettings) {
		this.validationEnabled = !raw || raw.validate !== false;
		this.lintSettings = sanitize(raw && raw.lint || {});
	}

	public doValidation(document: TextDocument, stylesheet: nodes.Stylesheet): Diagnostic[] {
		if (!this.validationEnabled) {
			return [];
		}

		let entries: nodes.IMarker[] = [];
		entries.push.apply(entries, nodes.ParseErrorCollector.entries(stylesheet));
		entries.push.apply(entries, LintVisitor.entries(stylesheet, this.lintSettings));

		function toDiagnostic(marker: nodes.IMarker): Diagnostic {
			let range = Range.create(document.positionAt(marker.getOffset()), document.positionAt(marker.getOffset() + marker.getLength()));
			return <Diagnostic>{
				code: marker.getRule().id,
				source: document.languageId,
				message: marker.getMessage(),
				severity: marker.getLevel() === nodes.Level.Warning ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
				range: range
			};
		}

		return entries.filter(entry => entry.getLevel() !== nodes.Level.Ignore).map(toDiagnostic);
	}
}