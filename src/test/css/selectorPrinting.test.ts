/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import {Parser} from '../../parser/cssParser';
import * as nodes from '../../parser/cssNodes';
import * as selectorPrinter from '../../services/selectorPrinting';
import {TextDocument} from 'vscode-languageserver-types-commonjs';
import {MarkedString} from 'vscode-languageserver-types-commonjs';

function elementToString(element: selectorPrinter.Element): string {
	let label = element.findAttribute('name') || '';
	let attributes = element.attributes && element.attributes.filter(a => a.name !== 'name');
	if (attributes && attributes.length > 0) {
		label = label + '[';
		let needsSeparator = false;
		for (let attribute of attributes) {
			if (attribute.name !== 'name') {
				if (needsSeparator) {
					label = label + '|';
				}
				needsSeparator = true;
				label = label + attribute.name + '=' + attribute.value;
			}
		}
		label = label + ']';
	}


	if (element.children) {
		label = label + '{';
		for (let index = 0; index < element.children.length; index++) {
			if (index > 0) {
				label = label + '|';
			}
			label = label + elementToString(element.children[index]);
		}
		label = label + '}';
	}
	return label;
}

function doParse(p: Parser, input: string, selectorName: string): nodes.Selector {
	let document = TextDocument.create('test://test/test.css', 'css', 0, input);
	let styleSheet = p.parseStylesheet(document);

	let node = nodes.getNodeAtOffset(styleSheet, input.indexOf(selectorName));
	return <nodes.Selector> node.findParent(nodes.NodeType.Selector);
}

export function parseSelector(p: Parser, input: string, selectorName: string, expected: string): void {
	let selector = doParse(p, input, selectorName);
	let element = selectorPrinter.selectorToElement(selector);

	assert.equal(elementToString(element), expected);
}

export function assertElement(p: Parser, input: string, expected: { name: string; value: string }[]): void {
	let node = p.internalParse(input, p._parseSimpleSelector);
	let actual = selectorPrinter.toElement(node);

	assert.deepEqual(actual.attributes, expected);
}

export function parseSelectorToMarkedString(p: Parser, input: string, selectorName: string, expected: MarkedString[]): void {
	let selector = doParse(p, input, selectorName);
	let printedElement = selectorPrinter.selectorToMarkedString(selector);

	assert.deepEqual(printedElement, expected);
}

suite('CSS - Selector Printing', () => {

	test('class/hash/elementname/attr', function () {
		let p = new Parser();
		assertElement(p, 'element', [{ name: 'name', value: 'element' }]);
		assertElement(p, '.div', [{ name: 'class', value: 'div' }]);
		assertElement(p, '#first', [{ name: 'id', value: 'first' }]);
		assertElement(p, 'element.on', [{ name: 'name', value: 'element' }, { name: 'class', value: 'on' }]);
		assertElement(p, 'element.on#first', [{ name: 'name', value: 'element' }, { name: 'class', value: 'on' }, { name: 'id', value: 'first' }]);
		assertElement(p, '.on#first', [{ name: 'class', value: 'on' }, { name: 'id', value: 'first' }]);

		assertElement(p, '[lang=\'de\']', [{ name: 'lang', value: 'de' }]);
		assertElement(p, '[enabled]', [{ name: 'enabled', value: void 0 }]);

	});

	test('simple selector', function () {
		let p = new Parser();
		parseSelector(p, 'element { }', 'element', '{element}');
		parseSelector(p, 'element.div { }', 'element', '{element[class=div]}');
		parseSelector(p, 'element.on#first { }', 'element', '{element[class=on|id=first]}');
		parseSelector(p, 'element:hover { }', 'element', '{element[:hover=]}');
		parseSelector(p, 'element[lang=\'de\'] { }', 'element', '{element[lang=de]}');
		parseSelector(p, 'element[enabled] { }', 'element', '{element[enabled=undefined]}');
		parseSelector(p, 'element[foo~="warning"] { }', 'element', '{element[foo= … warning … ]}');
		parseSelector(p, 'element[lang|="en"] { }', 'element', '{element[lang=en-…]}');
		parseSelector(p, '* { }', '*', '{element}');
	});

	test('selector', function () {
		let p = new Parser();
		parseSelector(p, 'e1 e2 { }', 'e1', '{e1{…{e2}}}');
		parseSelector(p, 'e1 .div { }', 'e1', '{e1{…{[class=div]}}}');
		parseSelector(p, 'e1 > e2 { }', 'e2', '{e1{e2}}');
		parseSelector(p, 'e1, e2 { }', 'e1', '{e1}');
		parseSelector(p, 'e1 + e2 { }', 'e2', '{e1|e2}');
		parseSelector(p, 'e1 ~ e2 { }', 'e2', '{e1|e2|⋮|e2}');
	});

});

suite('CSS - MarkedStringPrinter selectors', () => {

	test('descendant selector', function () {
		let p = new Parser();
		parseSelectorToMarkedString(p, 'e1 e2 { }', 'e1', [{ language: 'html', value: '<e1>\n  …\n    <e2>' }]);
		parseSelectorToMarkedString(p, 'e1 .div { }', 'e1', [{ language: 'html', value: '<e1>\n  …\n    <element class="div">' }]);
	});
	test('child selector', function () {
		let p = new Parser();
		parseSelectorToMarkedString(p, 'e1 > e2 { }', 'e2', [{ language: 'html', value: '<e1>\n  <e2>' }]);
	});
	test('group selector', function () {
		let p = new Parser();
		parseSelectorToMarkedString(p, 'e1, e2 { }', 'e1', [{ language: 'html', value: '<e1>' }]);
		parseSelectorToMarkedString(p, 'e1, e2 { }', 'e2', [{ language: 'html', value: '<e2>' }]);
	});
	test('sibling selector', function () {
		let p = new Parser();
		parseSelectorToMarkedString(p, 'e1 + e2 { }', 'e2', [ { language: 'html', value: '<e1>\n<e2>' } ]);
		parseSelectorToMarkedString(p, 'e1 ~ e2 { }', 'e2', [ { language: 'html', value: '<e1>\n<e2>\n⋮\n<e2>' } ]);
	});

});
