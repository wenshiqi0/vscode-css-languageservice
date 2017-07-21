/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import * as cssLanguageService from '../../cssLanguageService';

import {TextDocument, Position} from 'vscode-languageserver-types-commonjs';
import {assertCompletion, ItemDescription} from '../css/completion.test';

function asPromise<T>(result:T) : Promise<T> {
	return Promise.resolve(result);
}

suite('SCSS - Completions', () => {

	let testCompletionFor = function (value: string, expected: { count?: number, items?: ItemDescription[] }): PromiseLike<void> {
		let offset = value.indexOf('|');
		value = value.substr(0, offset) + value.substr(offset + 1);

		let ls = cssLanguageService.getSCSSLanguageService();

		let document = TextDocument.create('test://test/test.scss', 'scss', 0, value);
		let position = Position.create(0, offset);
		let jsonDoc = ls.parseStylesheet(document);
		return asPromise(ls.doComplete(document, position, jsonDoc)).then(list => {
			if (expected.count) {
				assert.equal(list.items, expected.count);
			}
			if (expected.items) {
				for (let item of expected.items) {
					assertCompletion(list, item, document, offset);
				}
			}
		});
	};

	test('sylesheet', function (testDone): any {
		Promise.all([
			testCompletionFor('$i: 0; body { width: |', {
				items: [
					{ label: '$i', documentation: '0' }
				]
			}),
			testCompletionFor('@for $i from 1 through 3 { .item-#{|$i} { width: 2em * $i; } }', {
				items: [
					{ label: '$i' }
				]
			}),
			testCompletionFor('.foo { background-color: d|', {
				items: [
					{ label: 'darken' },
					{ label: 'desaturate' }
				]
			}),
			testCompletionFor('@function foo($x, $y) { @return $x + $y; } .foo { background-color: f|', {
				items: [
					{ label: 'foo', resultText: '@function foo($x, $y) { @return $x + $y; } .foo { background-color: foo(${1:$x}, ${2:$y})' }
				]
			}),
			testCompletionFor('@mixin mixin($a: 1, $b) { content: $|}', {
				items: [
					{ label: '$a', documentation: '1', detail: 'argument from \'mixin\'' },
					{ label: '$b', documentation: null, detail: 'argument from \'mixin\'' }
				]
			}),
			testCompletionFor('@mixin mixin($a: 1, $b) { content: $a + $b; } @include m|', {
				items: [
					{ label: 'mixin', resultText: '@mixin mixin($a: 1, $b) { content: $a + $b; } @include mixin(${1:$a}, ${2:$b})' }
				]
			}),
			testCompletionFor('di| span { } ', {
				items: [
					{ label: 'div' }
				]
			}),
			testCompletionFor('span { di|} ', {
				items: [
					{ notAvailable: true, label: 'div' },
					{ label: 'display' }
				]
			}),
			testCompletionFor('.foo { .|', {
				items: [
					{ label: '.foo' }
				]
			}),
			// issue #250
			testCompletionFor('.foo { display: block;|', {
				count: 0
			}),
		]).then(() => testDone(), (error) => testDone(error));

	});
});
