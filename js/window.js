var windows = [];

function initWindows() {
    windows = document.querySelectorAll(".window");
    
    windows.forEach((window) => {
        makeDraggable(window);

        let pos = localStorage.getItem("rem_window_pos-" + window.id);
        
        if (pos)
        {
            pos = pos.split(";");
        
            window.style.top  = pos[0] + 'px';
            window.style.left = pos[1] + 'px';
        }
    });
   
}

function makeDraggable (elmnt) {
    // Make an element draggable (or if it has a .window-top class, drag based on the .window-top element)
    let currentPosX = 0, currentPosY = 0, previousPosX = 0, previousPosY = 0;

		// If there is a window-top classed element, attach to that element instead of full window
    if (elmnt.querySelector('.window-top')) {
        // If present, the window-top element is where you move the parent element from
        elmnt.querySelector('.window-top').onmousedown = dragMouseDown;
    } 
    else {
        // Otherwise, move the element itself
        elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown (e) {
        // Prevent any default action on this element (you can remove if you need this element to perform its default action)
        e.preventDefault();
        // Get the mouse cursor position and set the initial previous positions to begin
        previousPosX = e.clientX;
        previousPosY = e.clientY;
        // When the mouse is let go, call the closing event
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves
        document.onmousemove = elementDrag;
    }

    function elementDrag (e) {
        // Prevent any default action on this element (you can remove if you need this element to perform its default action)
        e.preventDefault();
        // Calculate the new cursor position by using the previous x and y positions of the mouse
        currentPosX = previousPosX - e.clientX;
        currentPosY = previousPosY - e.clientY;
        // Replace the previous positions with the new x and y positions of the mouse
        previousPosX = e.clientX;
        previousPosY = e.clientY;
        // Set the element's new position
        let top = (elmnt.offsetTop - currentPosY);
        let left = (elmnt.offsetLeft - currentPosX);

        top = (top < 0  ? 0 : top);
        top = (top > (window.innerHeight-50) ? (window.innerHeight-50) : top);

        left = (left < 0  ? 0 : left);
        left = (left > (window.innerWidth-50) ? (window.innerWidth-50) : left);

        elmnt.style.top  = top  + 'px';
        elmnt.style.left = left + 'px';
    }

    function closeDragElement (e) {
        document.onmouseup = null;
        document.onmousemove = null;

        localStorage.setItem("rem_window_pos-" + elmnt.id, elmnt.offsetTop + ";" + elmnt.offsetLeft);
    }
}
for (const minMaxElement of document.querySelectorAll('.round')) {
	minMaxElement.addEventListener('click', function (event) {
        var action = event.target.classList[1];
		var window = event.target.parentNode.parentNode;
      
        if (action == "close")
            window.classList.add("closed");

        if (action == "minimize")
        {
            window.querySelector(".window-content").classList.add("minimized");
            event.target.classList.remove("minimize");
            event.target.classList.add("maximize");
        }

        if (action == "maximize")
        {
            window.querySelector(".window-content").classList.remove("minimized");            
            event.target.classList.remove("maximize");
            event.target.classList.add("minimize");
        }

	});
}