import { beforeEach,describe,expect,it } from 'vitest';
import { usePlanner } from './store';
describe('planner store',()=>{beforeEach(()=>usePlanner.setState({items:[],selected:null,step:1}));it('adds a parametric furniture item',()=>{usePlanner.getState().add('wardrobe');const state=usePlanner.getState();expect(state.items[0]).toMatchObject({type:'wardrobe',width:1200,height:2100});expect(state.selected).toBe(state.items[0].id)});it('updates room dimensions',()=>{usePlanner.getState().setRoom({width:4200,length:3600,height:2700});expect(usePlanner.getState().room.width).toBe(4200)})});
