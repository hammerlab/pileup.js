/**
 * A generic menu, intended to be used for both toggling options and invoking commands.
 *
 * Usage:
 *
 * var items = [
 *   {key: 'a', label: 'Item A', checked: true},
 *   {key: 'b', label: 'Item B'},
 *   '-',
 *   {key: 'random', label: 'Pick Random'}
 * ];
 * <Menu header="Header" items={items} onSelect={selectHandler} />
 *
 * @flow
 */

'use strict';


import { SwatchesPicker } from 'react-color';
// https://casesandberg.github.io/react-color/
import React from 'react';

type MenuItem = {
  key: string;
  label: string;
  checked?: boolean;
  color?: string;
};

type Props = {
  header: string;
  items: Array<MenuItem|'-'>;
  onClick: (key: string) => void;
};

type ColorItem = {
    hex: string
}


type State = {
  showPalette: boolean[];
};

class Menu extends React.Component<Props> {
  props: Props;
  state: State;

  constructor(props: Object) {
      super(props);
      this.state = {
        showPalette: new Array(props.items.length).fill(false)
      };
  }

  toggleColorPicker(key: string, e: SyntheticEvent<>) {
    if (this.state.showPalette[key] == false) {
      this.state.showPalette[key] = true
      this.setState({showPalette: this.state.showPalette});
    } else {
        this.state.showPalette[key] = false
        this.setState({showPalette: this.state.showPalette});
    }
  }

  clickHandler(idx: number, e: SyntheticMouseEvent<>, togglePicker: boolean = true) {
    e.preventDefault();
    var item = this.props.items[idx];
    if (typeof(item) == 'string') return;  // for flow
    this.props.onClick(item.key);

    if (item.color && togglePicker) {
        this.toggleColorPicker(idx, e)
    }
    console.log("change color 3", this.props.items[idx].color);
  }

  handleColorChange(idx: number, color: Object, e: SyntheticMouseEvent<>) {
      console.log("change color", color);
      //  TODO: this is not updating the object
      this.props.items[idx].color.hex = color.hex;
      console.log("change color 2", this.props.items[idx].color);
      this.clickHandler(idx, e, false);
  };

  // is called whenever you re-click on the gear
  render(): any {
    var makeHandler = i => this.clickHandler.bind(this, i);
    var makeColorPickerHandler = i => this.handleColorChange.bind(this, i);

    var els = [];
    if (this.props.header) {
      els.push(<div key='header' className='menu-header'>{this.props.header}</div>);
    }
    els = els.concat(this.props.items.map((item, i) => {
      if (typeof(item) === 'string') {  // would prefer "== '-'", see flow#1066
        return <div key={i} className='menu-separator' />;
      } else {
        var checkClass = 'check' + (item.checked ? ' checked' : '');
        // initially hide color picker
        if (item.color) {
            var colorPicker = null

            if (this.state.showPalette[i]) {
                colorPicker = (
                    <SwatchesPicker
                        color={item.color.hex}
                        onChangeComplete={ makeColorPickerHandler(i) }
                    />)
            }

            return (
              <div  className='menu-item' >
                <span className={checkClass}></span>
                <span key={i} onClick={makeHandler(i)} className='menu-item-label'>{item.label}</span>
                {colorPicker}
              </div>
            );
        } else {
            return (
              <div key={i} className='menu-item' onClick={makeHandler(i)}>
                <span className={checkClass}></span>
                <span className='menu-item-label'>{item.label}</span>
              </div>
            );
        }
      }
    }));

    return (
      <div className='menu'>
        {els}
      </div>
    );
  }
}

module.exports = Menu;
