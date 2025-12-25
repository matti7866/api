import React from 'react';
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

class DropdownNotification extends React.Component {
	constructor(props) {
		super(props);

		this.toggle = this.toggle.bind(this);
		this.state = {
			dropdownOpen: false
		};
	}

	toggle() {
		this.setState(prevState => ({
			dropdownOpen: !prevState.dropdownOpen
		}));
	}
  
	render() {
		return (
			<Dropdown isOpen={this.state.dropdownOpen} toggle={this.toggle} className="navbar-item dropdown" tag="div">
				<DropdownToggle className="navbar-link dropdown-toggle icon" tag="a">
					<i className="fa fa-bell"></i>
					<span className="badge">5</span>
				</DropdownToggle>
				<DropdownMenu className="dropdown-menu media-list dropdown-menu-end" right tag="div">
					<DropdownItem className="dropdown-header" tag="div" header>NOTIFICATIONS (5)</DropdownItem>
					<DropdownItem className="dropdown-item media">
						<div className="media-left">
							<i className="fa fa-bug media-object bg-gray-500"></i>
						</div>
						<div className="media-body">
							<h6 className="media-heading">Server Error Reports <i className="fa fa-exclamation-circle text-danger"></i></h6>
							<div className="text-muted fs-10px">3 minutes ago</div>
						</div>
					</DropdownItem>
					<DropdownItem className="dropdown-item media">
						<div className="media-left">
							<img src="../assets/img/user/user-1.jpg" className="media-object" alt="" />
							<i className="fab fa-facebook-messenger text-blue media-object-icon"></i>
						</div>
						<div className="media-body">
							<h6 className="media-heading">John Smith</h6>
							<p>Quisque pulvinar tellus sit amet sem scelerisque tincidunt.</p>
							<div className="text-muted fs-10px">25 minutes ago</div>
						</div>
					</DropdownItem>
					<DropdownItem className="dropdown-item media">
						<div className="media-left">
							<img src="../assets/img/user/user-2.jpg" className="media-object" alt="" />
							<i className="fab fa-facebook-messenger text-blue media-object-icon"></i>
						</div>
						<div className="media-body">
							<h6 className="media-heading">Olivia</h6>
							<p>Quisque pulvinar tellus sit amet sem scelerisque tincidunt.</p>
							<div className="text-muted fs-10px">35 minutes ago</div>
						</div>
					</DropdownItem>
					<DropdownItem className="dropdown-item media">
						<div className="media-left">
							<i className="fa fa-plus media-object bg-gray-500"></i>
						</div>
						<div className="media-body">
							<h6 className="media-heading"> New User Registered</h6>
							<div className="text-muted fs-10px">1 hour ago</div>
						</div>
					</DropdownItem>
					<DropdownItem className="dropdown-item media">
						<div className="media-left">
							<i className="fa fa-envelope media-object bg-gray-500"></i>
							<i className="fab fa-google text-warning media-object-icon fs-14px"></i>
						</div>
						<div className="media-body">
							<h6 className="media-heading"> New Email From John</h6>
							<div className="text-muted fs-10px">2 hour ago</div>
						</div>
					</DropdownItem>
					<DropdownItem className="dropdown-footer text-center">
						View more
					</DropdownItem>
				</DropdownMenu>
			</Dropdown>
		);
	}
};

export default DropdownNotification;
