import * as React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import SearchInput from '../lib/SearchInput/SearchInput';
import Setting from '@joplin/lib/models/Setting';
import { stateUtils } from '@joplin/lib/reducer';
import BaseModel from '@joplin/lib/BaseModel';
import uuid from '@joplin/lib/uuid';
const { connect } = require('react-redux');
import Note from '@joplin/lib/models/Note';
import { AppState } from '../../app.reducer';
const debounce = require('debounce');
const styled = require('styled-components').default;

export const Root = styled.div`
	position: relative;
	display: flex;
	width: 100%;
	min-width: 30px;
`;

interface Props {
	inputRef?: any;
	notesParentType: string;
	dispatch?: Function;
	selectedNoteId: string;
	isFocused?: boolean;
}

function SearchBar(props: Props) {
	const [query, setQuery] = useState('');
	const [searchStarted, setSearchStarted] = useState(false);
	const searchId = useRef(uuid.create());

	useEffect(() => {
		function search(searchId: string, query: string, dispatch: Function) {
			dispatch({
				type: 'SEARCH_UPDATE',
				search: {
					id: searchId,
					title: query,
					query_pattern: query,
					query_folder_id: null,
					type_: BaseModel.TYPE_SEARCH,
				},
			});

			dispatch({
				type: 'SEARCH_SELECT',
				id: searchId,
			});
		}

		const debouncedSearch = debounce(search, 500);
		if (searchStarted) debouncedSearch(searchId.current, query, props.dispatch);
		return () => {
			debouncedSearch.clear();
		};
	}, [query, searchStarted]);

	const onExitSearch = useCallback(async (navigateAway = true) => {
		setQuery('');
		setSearchStarted(false);

		if (navigateAway) {
			const note = props.selectedNoteId ? await Note.load(props.selectedNoteId) : null;

			if (note) {
				props.dispatch({
					type: 'FOLDER_AND_NOTE_SELECT',
					folderId: note.parent_id,
					noteId: note.id,
				});
			} else {
				const folderId = Setting.value('activeFolderId');
				if (folderId) {
					props.dispatch({
						type: 'FOLDER_SELECT',
						id: folderId,
					});
				}
			}
		}
	}, [props.selectedNoteId]);

	function onChange(event: any) {
		if (event.value.length === 0) {
			// Revert to previous state if query string becomes empty
			void onExitSearch();
			return;
		}
		setSearchStarted(true);
		setQuery(event.value);
	}

	function onFocus() {
		props.dispatch({
			type: 'FOCUS_SET',
			field: 'globalSearch',
		});
	}

	function onBlur() {
		// Do it after a delay so that the "Clear" button
		// can be clicked on (otherwise the field loses focus
		// and is resized before the click event has been processed)
		setTimeout(() => {
			props.dispatch({
				type: 'FOCUS_CLEAR',
				field: 'globalSearch',
			});
		}, 300);
	}

	const onKeyDown = useCallback((event: any) => {
		if (event.key === 'Escape') {
			if (document.activeElement) (document.activeElement as any).blur();
			void onExitSearch();
		}
	}, [onExitSearch]);

	const onSearchButtonClick = useCallback(() => {
		if (props.isFocused || searchStarted) {
			void onExitSearch();
		} else {
			setSearchStarted(true);
			props.inputRef.current.focus();
			props.dispatch({
				type: 'FOCUS_SET',
				field: 'globalSearch',
			});
		}
	}, [onExitSearch, props.isFocused, searchStarted]);

	useEffect(() => {
		if (props.notesParentType !== 'Search') {
			void onExitSearch(false);
		}
	}, [props.notesParentType, onExitSearch]);

	// When the searchbar is remounted, exit the search if it was previously open
	// or else other buttons stay hidden (e.g. when opening Layout Editor and closing it)
	// https://github.com/laurent22/joplin/issues/5953
	useEffect(() => {
		if (props.notesParentType === 'Search' || props.isFocused) {
			if (props.isFocused) {
				props.dispatch({
					type: 'FOCUS_CLEAR',
					field: 'globalSearch',
				});
			}
			void onExitSearch(true);
		}
	}, []);

	return (
		<Root className="search-bar">
			<SearchInput
				inputRef={props.inputRef}
				value={query}
				onChange={onChange}
				onFocus={onFocus}
				onBlur={onBlur}
				onKeyDown={onKeyDown}
				onSearchButtonClick={onSearchButtonClick}
				searchStarted={searchStarted}
			/>
		</Root>
	);
}

const mapStateToProps = (state: AppState) => {
	return {
		notesParentType: state.notesParentType,
		selectedNoteId: stateUtils.selectedNoteId(state),
		isFocused: state.focusedField === 'globalSearch',
	};
};

export default connect(mapStateToProps)(SearchBar);
